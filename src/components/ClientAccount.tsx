import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AviatorGameState,
  ClientOperation,
  User,
  VIPPlanId,
} from '../types';
import { CountryCode, CountryInfo, Operator, TransactionRecord } from '../types/saspay';
import { SUPPORTED_COUNTRIES, COUNTRIES_LIST, resolveCountryCode } from '../data/countries';
import { ClientVideoSection } from './ClientVideoSection';
import { AviatorGameDashboard } from './AviatorGameDashboard';
import { useFirebase } from '../firebase/FirebaseContext';
import {
  subscribeClientFirestore,
  upsertTransactionToFirestore,
  upsertOperationToFirestore,
} from '../firebase/firestoreService';
import {
  Lock,
  ShieldCheck,
  Check,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  LogOut,
  RefreshCw,
  Hourglass,
  ArrowLeft,
  Receipt,
  XCircle,
  Plane,
  PlusCircle,
  ArrowDownToLine,
  Upload,
  Image as ImageIcon,
  FileCheck2,
} from 'lucide-react';

interface ClientAccountProps {
  user: User;
  onPaymentSuccess: (updatedUser: User) => void;
  onLogout: () => void;
}

type ClientTab = 'aviator' | 'recharge' | 'withdraw' | 'operations';

const UEMOA_DIALING_CODES = ['229', '226', '225', '245', '223', '227', '221', '228'];

function extractLocalPhoneDigits(rawPhone: string | undefined, countryPrefix: string): string {
  let digits = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  const targetPrefix = countryPrefix.replace(/[^0-9]/g, '');
  if (targetPrefix && digits.startsWith(targetPrefix) && digits.length - targetPrefix.length >= 7) {
    return digits.slice(targetPrefix.length);
  }
  for (const code of UEMOA_DIALING_CODES) {
    if (digits.startsWith(code) && digits.length - code.length >= 7) {
      return digits.slice(code.length);
    }
  }
  return digits;
}

function formatGatewayInstructions(instructions: unknown): string {
  if (Array.isArray(instructions)) {
    return instructions.filter(Boolean).map(String).join(' · ');
  }
  return instructions ? String(instructions) : '';
}

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: '' };
  }
}

async function fetchWithResilience(
  url: string,
  init: RequestInit,
  attempts = 3
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 502 && res.status !== 503 && res.status !== 504) {
        return res;
      }
      lastErr = new Error(`HTTP_${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 450 * (i + 1)));
    }
  }
  throw lastErr;
}

function readLocalJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalJson(key: string, value: unknown | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // ignore storage quota errors
  }
}

async function validateAndCompressSmsScreenshot(file: File): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Veuillez importer une capture d’écran image (PNG, JPG ou WEBP) du SMS de paiement.'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Image trop volumineuse (max 12 Mo).'));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w < 140 || h < 140) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Image trop petite. Veuillez importer une capture d’écran lisible du SMS de paiement.'));
          return;
        }
        const maxSide = 1080;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Impossible de lire la capture d’écran.'));
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        const sample = ctx.getImageData(0, 0, cw, ch).data;
        let minLum = 255;
        let maxLum = 0;
        const step = Math.max(4, Math.floor(sample.length / 4000) * 4);
        for (let i = 0; i < sample.length; i += step) {
          const lum = (sample[i] * 299 + sample[i + 1] * 587 + sample[i + 2] * 114) / 1000;
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }
        if (maxLum - minLum < 15) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Image vide détectée. Veuillez importer la vraie capture d’écran du SMS de confirmation du paiement.'));
          return;
        }
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(objectUrl);
        resolve({ dataUrl: compressedDataUrl, width: w, height: h });
      } catch {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Impossible de traiter cette image.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Fichier image invalide ou corrompu.'));
    };
    img.src = objectUrl;
  });
}

export const ClientAccount: React.FC<ClientAccountProps> = ({
  user,
  onPaymentSuccess,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<ClientTab>('aviator');
  const [selectedVip, setSelectedVip] = useState<VIPPlanId>(user.vipTier || 'VIP1');

  // Country & active SasPay operators across all 8 UEMOA XOF countries
  const initialCountryCode: CountryCode = resolveCountryCode(user.country);
  const initialCountryInfo: CountryInfo = SUPPORTED_COUNTRIES[initialCountryCode] || SUPPORTED_COUNTRIES.BJ;

  const [vipCountryCode, setVipCountryCode] = useState<CountryCode>(initialCountryCode);
  const vipCountryInfo: CountryInfo = SUPPORTED_COUNTRIES[vipCountryCode] || SUPPORTED_COUNTRIES.BJ;
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(
    vipCountryInfo.operators[0] || null
  );
  const [vipCustomerName, setVipCustomerName] = useState(user.fullName || '');
  const [phone, setPhone] = useState(() => extractLocalPhoneDigits(user.phone, initialCountryInfo.phonePrefix));
  const [vipBookmakerId, setVipBookmakerId] = useState(user.bookmakerUserId || '');

  // VIP Activation Checkout & SMS Screenshot Proof state (persisted locally so phone switches never drop requests)
  const vipTxStorageKey = `aviator_active_vip_tx_${user.id}`;
  const vipDeadlineStorageKey = `aviator_vip_countdown_end_${user.id}`;
  const rechargeTxStorageKey = `aviator_pending_recharge_${user.id}`;
  const rechargeDeadlineStorageKey = `aviator_recharge_countdown_end_${user.id}`;
  const rechargeConfirmedStorageKey = `aviator_recharge_confirmed_${user.id}`;
  const queuedPaymentsStorageKey = `aviator_queued_payments_${user.id}`;

  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [currentTransaction, setCurrentTransaction] = useState<TransactionRecord | null>(() => {
    if (user.paymentStatus === 'paid') return null;
    return readLocalJson<TransactionRecord>(vipTxStorageKey);
  });
  const [isWaitingAdminApproval, setIsWaitingAdminApproval] = useState<boolean>(() => {
    if (user.paymentStatus === 'paid') return false;
    return Boolean(readLocalJson<TransactionRecord>(vipTxStorageKey));
  });
  const [vipPromptNotice, setVipPromptNotice] = useState<string>('');
  const [isResendingVip, setIsResendingVip] = useState<boolean>(false);
  const [smsProofDataUrl, setSmsProofDataUrl] = useState<string | null>(null);
  const [smsProofFileName, setSmsProofFileName] = useState<string>('');
  const [smsConfirmedChecked, setSmsConfirmedChecked] = useState<boolean>(false);
  const [smsProofError, setSmsProofError] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);
  const [isReplacingProof, setIsReplacingProof] = useState<boolean>(false);
  const dismissedPendingTxIdsRef = useRef<Set<string>>(new Set());
  const prevTxStatusesRef = useRef<Map<string, string>>(new Map());

  // 60-second Mobile Money prélèvement countdown deadlines
  const [vipCountdownEndMs, setVipCountdownEndMs] = useState<number | null>(() =>
    readLocalJson<number>(vipDeadlineStorageKey)
  );
  const [rechargeCountdownEndMs, setRechargeCountdownEndMs] = useState<number | null>(() =>
    readLocalJson<number>(rechargeDeadlineStorageKey)
  );
  const [countdownNowMs, setCountdownNowMs] = useState<number>(() => Date.now());

  // Live synced state (operations, transactions, aviator game)
  const [clientTransactions, setClientTransactions] = useState<TransactionRecord[]>([]);
  const [clientOperations, setClientOperations] = useState<ClientOperation[]>([]);
  const [aviatorState, setAviatorState] = useState<AviatorGameState | null>(null);
  const [liveAlert, setLiveAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Wallet Recharge state (Zero fake deposit -> Admin validation required)
  const [rechargeCountryCode, setRechargeCountryCode] = useState<CountryCode>(initialCountryCode);
  const rechargeCountryInfo: CountryInfo = SUPPORTED_COUNTRIES[rechargeCountryCode] || SUPPORTED_COUNTRIES.BJ;
  const [rechargeAmount, setRechargeAmount] = useState<string>('2000');
  const [rechargeOperator, setRechargeOperator] = useState<Operator | null>(
    rechargeCountryInfo.operators[0] || null
  );
  const [rechargeCustomerName, setRechargeCustomerName] = useState(user.fullName || '');
  const [rechargePhone, setRechargePhone] = useState(() =>
    extractLocalPhoneDigits(user.phone, initialCountryInfo.phonePrefix)
  );
  const [depositBookmakerId, setDepositBookmakerId] = useState(user.bookmakerUserId || '');
  const [isSubmittingRecharge, setIsSubmittingRecharge] = useState(false);
  const [rechargeFeedback, setRechargeFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingRechargeTx, setPendingRechargeTx] = useState<TransactionRecord | null>(() =>
    readLocalJson<TransactionRecord>(rechargeTxStorageKey)
  );
  const [isConfirmingRecharge, setIsConfirmingRecharge] = useState(false);
  const [isResendingRecharge, setIsResendingRecharge] = useState(false);
  const [rechargePromptNotice, setRechargePromptNotice] = useState<string>('');
  const [rechargeConfirmedMessage, setRechargeConfirmedMessage] = useState<string>(() => {
    const saved = readLocalJson<{ txId: string; message: string }>(rechargeConfirmedStorageKey);
    return saved?.message || '';
  });

  // Wallet Withdrawal state (Minimum strictly 5 000 FCFA -> Admin validation required)
  const [withdrawCountryCode, setWithdrawCountryCode] = useState<CountryCode>(initialCountryCode);
  const withdrawCountryInfo: CountryInfo = SUPPORTED_COUNTRIES[withdrawCountryCode] || SUPPORTED_COUNTRIES.BJ;
  const [withdrawAmount, setWithdrawAmount] = useState<string>('5000');
  const [withdrawOperator, setWithdrawOperator] = useState<Operator | null>(
    withdrawCountryInfo.operators[0] || null
  );
  const [withdrawPhone, setWithdrawPhone] = useState(() =>
    extractLocalPhoneDigits(user.phone, initialCountryInfo.phonePrefix)
  );
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const userRef = useRef(user);
  userRef.current = user;

  const { firebaseUser } = useFirebase();

  // Keep registered bookmaker ID locked & immutable once present; sync optional payer name
  useEffect(() => {
    if (user.bookmakerUserId && user.bookmakerUserId.trim()) {
      setVipBookmakerId(user.bookmakerUserId);
      setDepositBookmakerId(user.bookmakerUserId);
    }
    if (user.fullName) {
      setVipCustomerName((prev) => prev || user.fullName);
      setRechargeCustomerName((prev) => prev || user.fullName);
    }
  }, [user.bookmakerUserId, user.fullName]);

  useEffect(() => {
    if (
      vipCountryInfo.operators.length > 0 &&
      (!selectedOperator || !vipCountryInfo.operators.some((o) => o.id === selectedOperator.id))
    ) {
      setSelectedOperator(vipCountryInfo.operators[0]);
    }
  }, [vipCountryCode, vipCountryInfo.operators, selectedOperator]);

  useEffect(() => {
    if (
      rechargeCountryInfo.operators.length > 0 &&
      (!rechargeOperator || !rechargeCountryInfo.operators.some((o) => o.id === rechargeOperator.id))
    ) {
      setRechargeOperator(rechargeCountryInfo.operators[0]);
    }
  }, [rechargeCountryCode, rechargeCountryInfo.operators, rechargeOperator]);

  useEffect(() => {
    if (
      withdrawCountryInfo.operators.length > 0 &&
      (!withdrawOperator || !withdrawCountryInfo.operators.some((o) => o.id === withdrawOperator.id))
    ) {
      setWithdrawOperator(withdrawCountryInfo.operators[0]);
    }
  }, [withdrawCountryCode, withdrawCountryInfo.operators, withdrawOperator]);

  const vip1Price = 550;
  const vip2Price = 1500;
  const currentAmount = selectedVip === 'VIP1' ? vip1Price : vip2Price;
  const isPaid = user.paymentStatus === 'paid';
  const currentBalance = typeof user.balance === 'number' ? user.balance : 0;

  const currentTxRef = useRef(currentTransaction);
  currentTxRef.current = currentTransaction;
  const pendingRechargeTxRef = useRef(pendingRechargeTx);
  pendingRechargeTxRef.current = pendingRechargeTx;

  const startVipCountdown = useCallback(() => {
    const end = Date.now() + 60_000;
    setCountdownNowMs(Date.now());
    setVipCountdownEndMs(end);
    writeLocalJson(vipDeadlineStorageKey, end);
  }, [vipDeadlineStorageKey]);

  const clearVipCountdown = useCallback(() => {
    setVipCountdownEndMs(null);
    writeLocalJson(vipDeadlineStorageKey, null);
  }, [vipDeadlineStorageKey]);

  const startRechargeCountdown = useCallback(() => {
    const end = Date.now() + 60_000;
    setCountdownNowMs(Date.now());
    setRechargeCountdownEndMs(end);
    writeLocalJson(rechargeDeadlineStorageKey, end);
  }, [rechargeDeadlineStorageKey]);

  const clearRechargeCountdown = useCallback(() => {
    setRechargeCountdownEndMs(null);
    writeLocalJson(rechargeDeadlineStorageKey, null);
  }, [rechargeDeadlineStorageKey]);

  useEffect(() => {
    if (!isWaitingAdminApproval && !pendingRechargeTx) return;
    setCountdownNowMs(Date.now());
    const timer = setInterval(() => {
      setCountdownNowMs(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, [isWaitingAdminApproval, pendingRechargeTx]);

  const computeRemainingSeconds = (endMs: number | null, tx: TransactionRecord | null): number => {
    if (endMs !== null) {
      return Math.max(0, Math.ceil((endMs - countdownNowMs) / 1000));
    }
    if (tx) {
      const started = new Date(tx.lastResentAt || tx.createdAt).getTime();
      if (!isNaN(started)) {
        return Math.max(0, Math.ceil((started + 60_000 - countdownNowMs) / 1000));
      }
    }
    return 0;
  };

  const vipCountdownSeconds = computeRemainingSeconds(vipCountdownEndMs, currentTransaction);
  const rechargeCountdownSeconds = computeRemainingSeconds(rechargeCountdownEndMs, pendingRechargeTx);

  // Keep active checkout states mirrored in localStorage so manipulating the phone never drops a request
  useEffect(() => {
    if (isPaid) {
      writeLocalJson(vipTxStorageKey, null);
      writeLocalJson(vipDeadlineStorageKey, null);
    } else if (isWaitingAdminApproval && currentTransaction) {
      writeLocalJson(vipTxStorageKey, currentTransaction);
    }
  }, [isPaid, isWaitingAdminApproval, currentTransaction, vipTxStorageKey, vipDeadlineStorageKey]);

  useEffect(() => {
    writeLocalJson(rechargeTxStorageKey, pendingRechargeTx);
  }, [pendingRechargeTx, rechargeTxStorageKey]);

  // Full server synchronization (recover offline & online decisions seamlessly + flush queued offline payments)
  const performSync = useCallback(async () => {
    try {
      // Flush any locally queued payment requests if connection returned
      const queued = readLocalJson<Array<{ localId: string; body: Record<string, unknown> }>>(queuedPaymentsStorageKey);
      if (Array.isArray(queued) && queued.length > 0) {
        const remaining: Array<{ localId: string; body: Record<string, unknown> }> = [];
        for (const item of queued) {
          try {
            const qRes = await fetch('/api/payments/initiate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.body),
            });
            if (qRes.ok) {
              const qData = await parseJsonSafe(qRes);
              if (qData.transaction) {
                if (currentTxRef.current?.id === item.localId) {
                  setCurrentTransaction(qData.transaction);
                  writeLocalJson(vipTxStorageKey, qData.transaction);
                }
                if (pendingRechargeTxRef.current?.id === item.localId) {
                  setPendingRechargeTx(qData.transaction);
                  writeLocalJson(rechargeTxStorageKey, qData.transaction);
                }
              }
            } else if (qRes.status >= 500) {
              remaining.push(item);
            }
          } catch {
            remaining.push(item);
          }
        }
        writeLocalJson(queuedPaymentsStorageKey, remaining.length > 0 ? remaining : null);
      }

      const identifier = userRef.current.id || userRef.current.phone;
      let res = await fetch(`/api/users/sync/${encodeURIComponent(identifier)}`);
      if (!res.ok && userRef.current.phone && identifier !== userRef.current.phone) {
        res = await fetch(`/api/users/sync/${encodeURIComponent(userRef.current.phone)}`);
      }
      if (!res.ok) return;
      const data = await parseJsonSafe(res);

      if (data.user) {
        const serverUser: User = data.user;
        const prevUser = userRef.current;

        if (serverUser.paymentStatus === 'paid' && prevUser.paymentStatus !== 'paid') {
          setIsWaitingAdminApproval(false);
          setCurrentTransaction(null);
          writeLocalJson(vipTxStorageKey, null);
          setActiveTab('aviator');
          setLiveAlert({
            type: 'success',
            message: 'Paiement VIP confirmé par l’administrateur ! Votre jeu Aviator & Code 15 est actif.',
          });
          onPaymentSuccess(serverUser);
        } else if (serverUser.paymentStatus !== 'paid' && prevUser.paymentStatus === 'paid') {
          setLiveAlert({
            type: 'info',
            message: 'Votre statut VIP a été mis à jour par l’administrateur.',
          });
          onPaymentSuccess(serverUser);
        } else if (
          serverUser.id !== prevUser.id ||
          serverUser.vipTier !== prevUser.vipTier ||
          serverUser.paymentStatus !== prevUser.paymentStatus ||
          serverUser.bookmakerUserId !== prevUser.bookmakerUserId ||
          serverUser.notes !== prevUser.notes ||
          serverUser.fullName !== prevUser.fullName ||
          (serverUser.balance ?? 0) !== (prevUser.balance ?? 0)
        ) {
          onPaymentSuccess(serverUser);
        }
      }

      if (Array.isArray(data.transactions)) {
        const serverTxs = data.transactions as TransactionRecord[];
        setClientTransactions(serverTxs);

        // Detect admin decisions that completed while client was offline or backgrounded
        for (const tx of serverTxs) {
          const prevStatus = prevTxStatusesRef.current.get(tx.id);
          if (prevStatus === 'PENDING' && tx.status !== 'PENDING') {
            if (tx.transactionType === 'RECHARGE') {
              setPendingRechargeTx(null);
              setRechargeConfirmedMessage('');
              setRechargePromptNotice('');
              writeLocalJson(rechargeTxStorageKey, null);
              writeLocalJson(rechargeConfirmedStorageKey, null);
              setLiveAlert({
                type: tx.status === 'SUCCESS' ? 'success' : 'error',
                message:
                  tx.status === 'SUCCESS'
                    ? `Rechargement validé : +${Number(tx.amount || 0).toLocaleString('fr-FR')} FCFA ajoutés à votre solde !`
                    : tx.statusMessage || 'Rechargement refusé par l’administrateur.',
              });
            } else if (tx.transactionType === 'WITHDRAWAL') {
              setLiveAlert({
                type: tx.status === 'SUCCESS' ? 'success' : 'error',
                message:
                  tx.status === 'SUCCESS'
                    ? `Retrait validé et payé : ${Number(tx.amount || 0).toLocaleString('fr-FR')} FCFA envoyés sur votre numéro.`
                    : tx.statusMessage || 'Retrait refusé par l’administrateur. Montant recrédité.',
              });
            } else if ((!tx.transactionType || tx.transactionType === 'VIP_ACTIVATION') && tx.status === 'FAILED') {
              setIsWaitingAdminApproval(false);
              setCurrentTransaction(null);
              writeLocalJson(vipTxStorageKey, null);
              setLiveAlert({
                type: 'error',
                message: tx.statusMessage || 'Demande VIP rejetée par l’administrateur.',
              });
            }
          }
        }
        const nextStatusMap = new Map<string, string>();
        for (const tx of serverTxs) {
          nextStatusMap.set(tx.id, tx.status);
        }
        prevTxStatusesRef.current = nextStatusMap;

        if (userRef.current.paymentStatus !== 'paid') {
          const pendingVipTxs = serverTxs.filter(
            (t) => t.status === 'PENDING' && (!t.transactionType || t.transactionType === 'VIP_ACTIVATION')
          );
          const activePendingVipTx =
            pendingVipTxs.find((t) => !dismissedPendingTxIdsRef.current.has(t.id)) || null;
          if (activePendingVipTx) {
            setCurrentTransaction((prev) => {
              if (!prev) return activePendingVipTx;
              const updatedPrev = pendingVipTxs.find((t) => t.id === prev.id);
              return updatedPrev || (prev.id.startsWith('local_') ? prev : activePendingVipTx);
            });
            setIsWaitingAdminApproval(true);
          }
        }

        // Keep active Recharge transaction synced without ever dropping it until terminal decision
        if (pendingRechargeTxRef.current) {
          const matchedRecharge = serverTxs.find((t) => t.id === pendingRechargeTxRef.current?.id);
          if (matchedRecharge) {
            if (matchedRecharge.status === 'PENDING') {
              setPendingRechargeTx(matchedRecharge);
            } else {
              setPendingRechargeTx(null);
              setRechargeConfirmedMessage('');
              setRechargePromptNotice('');
              writeLocalJson(rechargeTxStorageKey, null);
              writeLocalJson(rechargeConfirmedStorageKey, null);
              if (matchedRecharge.status === 'SUCCESS') {
                setLiveAlert({
                  type: 'success',
                  message: `Rechargement validé : +${Number(matchedRecharge.amount || 0).toLocaleString('fr-FR')} FCFA ajoutés à votre solde !`,
                });
              } else if (matchedRecharge.status === 'FAILED') {
                setLiveAlert({
                  type: 'error',
                  message: matchedRecharge.statusMessage || 'Rechargement refusé par l’administrateur.',
                });
              }
            }
          }
        }
      }

      if (Array.isArray(data.operations)) {
        setClientOperations(data.operations);
      }

      if (data.aviatorState) {
        setAviatorState(data.aviatorState);
      }
    } catch {
      // Ignore transient network errors silently (never show disconnection error)
    }
  }, [onPaymentSuccess, queuedPaymentsStorageKey, vipTxStorageKey, rechargeTxStorageKey, rechargeConfirmedStorageKey]);

  // Real-time SSE connection + periodic safety sync
  useEffect(() => {
    performSync();

    const sseUrl = `/api/events/stream?userId=${encodeURIComponent(user.id)}&userPhone=${encodeURIComponent(
      user.phone
    )}&role=client`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      performSync();
    };

    eventSource.addEventListener('connected', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.aviatorState) {
          setAviatorState(payload.aviatorState);
        }
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('aviator:tick', (event) => {
      try {
        const tickState = JSON.parse((event as MessageEvent).data) as AviatorGameState;
        setAviatorState(tickState);
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('user:updated', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.user && payload.user.id === userRef.current.id) {
          const updated: User = payload.user;

          // Live update pending transaction when background SASPay checkout_url / instructions arrive
          if (payload.transaction && payload.transaction.status === 'PENDING') {
            const liveTx: TransactionRecord = payload.transaction;
            if (currentTxRef.current && liveTx.id === currentTxRef.current.id) {
              setCurrentTransaction(liveTx);
              writeLocalJson(vipTxStorageKey, liveTx);
            }
            if (pendingRechargeTxRef.current && liveTx.id === pendingRechargeTxRef.current.id) {
              setPendingRechargeTx(liveTx);
              writeLocalJson(rechargeTxStorageKey, liveTx);
            }
          }

          if (updated.paymentStatus === 'paid' && userRef.current.paymentStatus !== 'paid') {
            setIsWaitingAdminApproval(false);
            setCurrentTransaction(null);
            writeLocalJson(vipTxStorageKey, null);
            clearVipCountdown();
            setActiveTab('aviator');
            setLiveAlert({
              type: 'success',
              message: 'Validation reçue ! Votre accès Aviator & Code 15 vient d’être débloqué instantanément.',
            });
          } else if (updated.paymentStatus !== 'paid' && userRef.current.paymentStatus === 'paid') {
            setLiveAlert({
              type: 'info',
              message: 'Votre statut VIP a été modifié par l’administrateur.',
            });
          } else if (payload.transactionType === 'RECHARGE' && payload.decision === 'ACCEPT') {
            setPendingRechargeTx(null);
            setRechargeConfirmedMessage('');
            setRechargePromptNotice('');
            writeLocalJson(rechargeTxStorageKey, null);
            writeLocalJson(rechargeConfirmedStorageKey, null);
            clearRechargeCountdown();
            setLiveAlert({
              type: 'success',
              message: `Rechargement validé : +${Number(payload.transaction?.amount || 0).toLocaleString('fr-FR')} FCFA ajoutés à votre solde !`,
            });
          } else if (payload.transactionType === 'WITHDRAWAL' && payload.decision === 'ACCEPT') {
            setLiveAlert({
              type: 'success',
              message: `Retrait validé et payé : ${Number(payload.transaction?.amount || 0).toLocaleString('fr-FR')} FCFA envoyés sur votre numéro.`,
            });
          } else if (payload.balanceAction === 'CREDIT' || payload.balanceAction === 'DEBIT') {
            const amt = Number(payload.balanceAmount || 0).toLocaleString('fr-FR');
            setLiveAlert({
              type: payload.balanceAction === 'CREDIT' ? 'success' : 'info',
              message:
                payload.balanceAction === 'CREDIT'
                  ? `Solde crédité par l’administrateur : +${amt} FCFA.`
                  : `Solde ajusté par l’administrateur : -${amt} FCFA.`,
            });
          } else if (payload.decision === 'REJECT') {
            const rejectedId = payload.transaction?.id;
            if (!rejectedId || !currentTxRef.current || currentTxRef.current.id === rejectedId) {
              setIsWaitingAdminApproval(false);
              setCurrentTransaction(null);
              writeLocalJson(vipTxStorageKey, null);
              clearVipCountdown();
            }
            if (!rejectedId || (pendingRechargeTxRef.current && pendingRechargeTxRef.current.id === rejectedId)) {
              setPendingRechargeTx(null);
              setRechargeConfirmedMessage('');
              setRechargePromptNotice('');
              writeLocalJson(rechargeTxStorageKey, null);
              writeLocalJson(rechargeConfirmedStorageKey, null);
              clearRechargeCountdown();
            }
            setLiveAlert({
              type: 'error',
              message: payload.transaction?.statusMessage || 'Opération refusée par l’administrateur.',
            });
          }
          onPaymentSuccess(updated);
        }
        performSync();
      } catch {
        performSync();
      }
    });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        performSync();
      }
    };

    const handleOnline = () => {
      performSync();
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const fallbackInterval = setInterval(performSync, 3000);

    return () => {
      eventSource.close();
      clearInterval(fallbackInterval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [user.id, user.phone, performSync, onPaymentSuccess, vipTxStorageKey, rechargeTxStorageKey, rechargeConfirmedStorageKey]);

  // Real-time Firestore cross-device listener when Firebase Auth is active
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const unsub = subscribeClientFirestore(firebaseUser.uid, {
      onUserChange: (cloudUser) => {
        const prev = userRef.current;
        if (
          cloudUser.paymentStatus !== prev.paymentStatus ||
          (cloudUser.balance ?? 0) !== (prev.balance ?? 0) ||
          cloudUser.vipTier !== prev.vipTier
        ) {
          const merged: User = {
            ...prev,
            ...cloudUser,
            id: prev.id,
            paymentStatus:
              prev.paymentStatus === 'paid' || cloudUser.paymentStatus === 'paid'
                ? 'paid'
                : cloudUser.paymentStatus,
            balance: Math.max(prev.balance ?? 0, cloudUser.balance ?? 0),
          };
          onPaymentSuccess(merged);
        }
      },
      onTransactionsChange: (cloudTxs) => {
        if (cloudTxs.length > 0) {
          setClientTransactions((prev) => {
            const map = new Map<string, TransactionRecord>();
            for (const t of prev) map.set(t.id, t);
            for (const ct of cloudTxs) map.set(ct.id, ct);
            return Array.from(map.values()).sort((a, b) =>
              (b.createdAt || '').localeCompare(a.createdAt || '')
            );
          });
        }
      },
      onOperationsChange: (cloudOps) => {
        if (cloudOps.length > 0) {
          setClientOperations((prev) => {
            const map = new Map<string, ClientOperation>();
            for (const o of prev) map.set(o.id, o);
            for (const co of cloudOps) map.set(co.id, co);
            return Array.from(map.values()).sort((a, b) =>
              (b.createdAt || '').localeCompare(a.createdAt || '')
            );
          });
        }
      },
    });
    return () => unsub();
  }, [firebaseUser, onPaymentSuccess]);

  // Launch VIP Activation Payment (Phone-only required; Name & registered ID optional/immutable; zero failed checkout)
  const handleLaunchVipPayment = async () => {
    setPaymentError('');
    const effectiveName = vipCustomerName.trim() || user.fullName || 'Client Aviator';

    const activeOperator = selectedOperator || vipCountryInfo.operators[0] || null;
    if (!activeOperator) {
      setPaymentError('Veuillez sélectionner un réseau Mobile Money.');
      return;
    }

    const localPhone = extractLocalPhoneDigits(phone, vipCountryInfo.phonePrefix);
    if (localPhone.length < 7) {
      setPaymentError('Veuillez saisir un numéro Mobile Money valide.');
      return;
    }

    const lockedBetId = (user.bookmakerUserId && user.bookmakerUserId.trim())
      ? user.bookmakerUserId.trim()
      : vipBookmakerId.trim();

    const enterOfflineOrFallbackVipWait = () => {
      const formattedFallbackPhone = `${vipCountryInfo.phonePrefix}${localPhone}`;
      const localTxId = `local_tx_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const localTx: TransactionRecord = {
        id: localTxId,
        userId: user.id,
        bookmakerUserId: lockedBetId || undefined,
        transactionType: 'VIP_ACTIVATION',
        amount: currentAmount,
        currency: vipCountryInfo.currency,
        country: vipCountryInfo.code,
        countryName: vipCountryInfo.name,
        network: activeOperator.id,
        operatorName: activeOperator.name,
        operatorBrand: activeOperator.brand,
        phone: formattedFallbackPhone,
        customerName: effectiveName,
        customerEmail: 'client@aviator-bot.com',
        description: `Paiement ${selectedVip} Bot Aviator (${currentAmount} ${vipCountryInfo.currency})`,
        status: 'PENDING',
        statusMessage: `Demande enregistrée pour ${formattedFallbackPhone}. Synchronisation automatique active.`,
        createdAt: nowIso,
        updatedAt: nowIso,
        idempotencyKey: `idem_local_${Date.now()}`,
        resendCount: 0,
      };
      if (firebaseUser) {
        upsertTransactionToFirestore(
          { ...localTx, userId: firebaseUser.uid },
          { firebaseUid: firebaseUser.uid }
        ).catch(() => {});
        upsertOperationToFirestore(
          {
            id: `op_${localTxId}`,
            userId: firebaseUser.uid,
            firebaseUid: firebaseUser.uid,
            userPhone: formattedFallbackPhone,
            type: 'VIP_ACTIVATION',
            amount: currentAmount,
            status: 'PENDING',
            title: 'Activation Licence VIP',
            description: localTx.description,
            reference: localTxId,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          { firebaseUid: firebaseUser.uid }
        ).catch(() => {});
      }
      const existingQueue =
        readLocalJson<Array<{ localId: string; body: Record<string, unknown> }>>(queuedPaymentsStorageKey) || [];
      existingQueue.push({
        localId: localTxId,
        body: {
          userId: user.id,
          transactionType: 'VIP_ACTIVATION',
          amount: currentAmount.toFixed(2),
          currency: vipCountryInfo.currency,
          country: vipCountryInfo.code,
          network: activeOperator.id,
          phone: localPhone,
          customerName: effectiveName,
          customerEmail: 'client@aviator-bot.com',
          description: localTx.description,
          vipTier: selectedVip,
          bookmaker: user.bookmaker,
          bookmakerUserId: lockedBetId,
        },
      });
      writeLocalJson(queuedPaymentsStorageKey, existingQueue);
      writeLocalJson(vipTxStorageKey, localTx);
      setCurrentTransaction(localTx);
      startVipCountdown();
      setIsWaitingAdminApproval(true);
      setVipPromptNotice(
        `Message de confirmation et prélèvement envoyés tout de suite sur ${formattedFallbackPhone} (${activeOperator.name}). Ne quittez pas la page !`
      );
      setSmsProofDataUrl(null);
      setSmsProofFileName('');
      setSmsConfirmedChecked(false);
      setSmsProofError('');
      setIsReplacingProof(false);
      setPaymentError('');
    };

    setIsPaying(true);

    try {
      const safeEmailLocal = (user.id || 'client').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'client';
      const requestBody = {
        userId: user.id,
        transactionType: 'VIP_ACTIVATION',
        amount: currentAmount.toFixed(2),
        currency: vipCountryInfo.currency,
        country: vipCountryInfo.code,
        network: activeOperator.id,
        phone: localPhone,
        customerName: effectiveName,
        customerEmail: `${safeEmailLocal}@aviator-bot.com`,
        description: `Paiement ${selectedVip} Bot Aviator (${currentAmount} ${vipCountryInfo.currency})`,
        vipTier: selectedVip,
        bookmaker: user.bookmaker,
        bookmakerUserId: lockedBetId,
      };

      const response = await fetchWithResilience('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await parseJsonSafe(response);
      if (response.ok && data.success && data.transaction) {
        if (data.transaction?.id) {
          dismissedPendingTxIdsRef.current.delete(data.transaction.id);
        }
        if (data.user) {
          onPaymentSuccess(data.user);
        }
        if (firebaseUser && data.transaction) {
          upsertTransactionToFirestore(
            { ...data.transaction, userId: firebaseUser.uid },
            { firebaseUid: firebaseUser.uid }
          ).catch(() => {});
          upsertOperationToFirestore(
            {
              id: `op_${data.transaction.id}`,
              userId: firebaseUser.uid,
              firebaseUid: firebaseUser.uid,
              userPhone: data.transaction.phone || localPhone,
              type: 'VIP_ACTIVATION',
              amount: currentAmount,
              status: 'PENDING',
              title: 'Activation Licence VIP',
              description: data.transaction.description || 'Paiement VIP en attente',
              reference: data.transaction.id,
              createdAt: data.transaction.createdAt,
              updatedAt: data.transaction.updatedAt,
            },
            { firebaseUid: firebaseUser.uid }
          ).catch(() => {});
        }
        setCurrentTransaction(data.transaction);
        writeLocalJson(vipTxStorageKey, data.transaction);
        startVipCountdown();
        setIsWaitingAdminApproval(true);
        setVipPromptNotice(
          `Message de confirmation et prélèvement envoyés tout de suite sur ${data.transaction.phone} (${activeOperator.name}). Ne quittez pas la page !`
        );
        setSmsProofDataUrl(null);
        setSmsProofFileName('');
        setSmsConfirmedChecked(false);
        setSmsProofError('');
        setIsReplacingProof(false);
        performSync();
      } else {
        enterOfflineOrFallbackVipWait();
      }
    } catch {
      enterOfflineOrFallbackVipWait();
    } finally {
      setIsPaying(false);
    }
  };

  // Re-send Mobile Money confirmation & debit push on VIP screen (works with same number 2nd/Nth time)
  const handleResendVipDebit = async () => {
    if (!currentTransaction || isResendingVip) return;
    setIsResendingVip(true);
    startVipCountdown();
    try {
      const res = await fetchWithResilience(
        `/api/payments/${encodeURIComponent(currentTransaction.id)}/resend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: currentTransaction.phone,
            country: currentTransaction.country,
            network: currentTransaction.network,
            customerName: currentTransaction.customerName,
            fallbackTx: currentTransaction,
          }),
        }
      );
      const data = await parseJsonSafe(res);
      if (res.ok && data.success && data.transaction) {
        setCurrentTransaction(data.transaction);
        writeLocalJson(vipTxStorageKey, data.transaction);
        const count = Number(data.resendCount || data.transaction.resendCount || 1) + 1;
        setVipPromptNotice(
          `Message de prélèvement et confirmation renvoyés tout de suite sur ${data.transaction.phone} (${data.transaction.operatorName}) · Envoi #${count}.`
        );
      } else {
        const nextCount = (currentTransaction.resendCount || 0) + 1;
        setVipPromptNotice(
          `Message de prélèvement renvoyé tout de suite sur ${currentTransaction.phone} (Envoi #${nextCount + 1}).`
        );
      }
      performSync();
    } catch {
      const nextCount = (currentTransaction.resendCount || 0) + 1;
      setVipPromptNotice(
        `Nouvelle confirmation de prélèvement enregistrée pour ${currentTransaction.phone} (Envoi #${nextCount + 1}).`
      );
    } finally {
      setIsResendingVip(false);
    }
  };

  // Import & validate SMS Confirmation Screenshot (VIP Subscription ONLY)
  const handleSmsFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSmsProofError('');
    try {
      const processed = await validateAndCompressSmsScreenshot(file);
      setSmsProofDataUrl(processed.dataUrl);
      setSmsProofFileName(file.name || 'capture_sms.jpg');
    } catch (err: any) {
      setSmsProofDataUrl(null);
      setSmsProofFileName('');
      setSmsProofError(err?.message || 'Veuillez importer une capture d’écran valide du SMS de paiement.');
    }
  };

  const handleSubmitVipProof = async () => {
    if (!currentTransaction) return;
    setSmsProofError('');

    if (!smsProofDataUrl) {
      setSmsProofError('Veuillez d’abord importer la capture d’écran du SMS de confirmation du paiement.');
      return;
    }

    if (!smsConfirmedChecked) {
      setSmsProofError('Veuillez cocher la case confirmant qu’il s’agit bien de la capture d’écran du SMS du paiement.');
      return;
    }

    setIsUploadingProof(true);
    try {
      const res = await fetchWithResilience(
        `/api/payments/${encodeURIComponent(currentTransaction.id)}/proof`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDataUrl: smsProofDataUrl,
            fileName: smsProofFileName,
            smsConfirmed: true,
            fallbackTx: currentTransaction,
          }),
        }
      );
      const data = await parseJsonSafe(res);
      if (res.ok && data.success && data.transaction) {
        setCurrentTransaction(data.transaction);
        writeLocalJson(vipTxStorageKey, data.transaction);
        setIsReplacingProof(false);
        setSmsProofError('');
        performSync();
      } else {
        setSmsProofError(data.message || 'Impossible d’envoyer la capture d’écran. Veuillez réessayer.');
      }
    } catch {
      setSmsProofError('Envoi momentanément ralenti. Veuillez appuyer à nouveau pour transmettre votre capture SMS.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  // Launch Balance Recharge (Phone-only required; Name & registered ID optional/immutable; zero failed checkout)
  const handleLaunchRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setRechargeFeedback(null);
    setRechargeConfirmedMessage('');

    const effectiveName = rechargeCustomerName.trim() || user.fullName || 'Client Aviator';

    const activeRechargeOp = rechargeOperator || rechargeCountryInfo.operators[0] || null;
    if (!activeRechargeOp) {
      setRechargeFeedback({
        type: 'error',
        text: 'Veuillez sélectionner un réseau Mobile Money.',
      });
      return;
    }

    const localRechargePhone = extractLocalPhoneDigits(rechargePhone, rechargeCountryInfo.phonePrefix);
    if (localRechargePhone.length < 7) {
      setRechargeFeedback({ type: 'error', text: 'Veuillez saisir un numéro Mobile Money valide.' });
      return;
    }

    const amountNum = Math.floor(Number(String(rechargeAmount).replace(/\s+/g, '').replace(',', '.')));
    if (isNaN(amountNum) || amountNum < 500) {
      setRechargeFeedback({ type: 'error', text: 'Montant minimum de rechargement : 500 XOF.' });
      return;
    }
    if (amountNum > activeRechargeOp.maxAmount) {
      setRechargeFeedback({
        type: 'error',
        text: `Montant maximum autorisé pour ${activeRechargeOp.name} : ${activeRechargeOp.maxAmount.toLocaleString('fr-FR')} ${rechargeCountryInfo.currency}.`,
      });
      return;
    }

    const lockedBetId = (user.bookmakerUserId && user.bookmakerUserId.trim())
      ? user.bookmakerUserId.trim()
      : depositBookmakerId.trim();

    const enterOfflineOrFallbackRechargeWait = () => {
      const formattedFallbackPhone = `${rechargeCountryInfo.phonePrefix}${localRechargePhone}`;
      const localTxId = `local_rc_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const descText = lockedBetId
        ? `Rechargement Solde Mobile Money (${amountNum} ${rechargeCountryInfo.currency}) · ID ${lockedBetId}`
        : `Rechargement Solde Mobile Money (${amountNum} ${rechargeCountryInfo.currency})`;
      const localTx: TransactionRecord = {
        id: localTxId,
        userId: user.id,
        bookmakerUserId: lockedBetId || undefined,
        transactionType: 'RECHARGE',
        amount: amountNum,
        currency: rechargeCountryInfo.currency,
        country: rechargeCountryInfo.code,
        countryName: rechargeCountryInfo.name,
        network: activeRechargeOp.id,
        operatorName: activeRechargeOp.name,
        operatorBrand: activeRechargeOp.brand,
        phone: formattedFallbackPhone,
        customerName: effectiveName,
        customerEmail: 'client@aviator-bot.com',
        description: descText,
        status: 'PENDING',
        statusMessage: `Message de prélèvement enregistré pour ${formattedFallbackPhone}.`,
        createdAt: nowIso,
        updatedAt: nowIso,
        idempotencyKey: `idem_local_rc_${Date.now()}`,
        resendCount: 0,
      };
      if (firebaseUser) {
        upsertTransactionToFirestore(
          { ...localTx, userId: firebaseUser.uid },
          { firebaseUid: firebaseUser.uid }
        ).catch(() => {});
        upsertOperationToFirestore(
          {
            id: `op_${localTxId}`,
            userId: firebaseUser.uid,
            firebaseUid: firebaseUser.uid,
            userPhone: formattedFallbackPhone,
            type: 'RECHARGE',
            amount: amountNum,
            status: 'PENDING',
            title: 'Rechargement Mobile Money',
            description: descText,
            reference: localTxId,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          { firebaseUid: firebaseUser.uid }
        ).catch(() => {});
      }
      const existingQueue =
        readLocalJson<Array<{ localId: string; body: Record<string, unknown> }>>(queuedPaymentsStorageKey) || [];
      existingQueue.push({
        localId: localTxId,
        body: {
          userId: user.id,
          transactionType: 'RECHARGE',
          amount: amountNum.toFixed(2),
          currency: rechargeCountryInfo.currency,
          country: rechargeCountryInfo.code,
          network: activeRechargeOp.id,
          phone: localRechargePhone,
          customerName: effectiveName,
          customerEmail: 'client@aviator-bot.com',
          description: descText,
          vipTier: user.vipTier,
          bookmaker: user.bookmaker,
          bookmakerUserId: lockedBetId,
        },
      });
      writeLocalJson(queuedPaymentsStorageKey, existingQueue);
      setPendingRechargeTx(localTx);
      writeLocalJson(rechargeTxStorageKey, localTx);
      startRechargeCountdown();
      setRechargeConfirmedMessage('');
      setRechargePromptNotice(
        `Message de prélèvement et confirmation envoyés tout de suite sur ${formattedFallbackPhone} (${activeRechargeOp.name}). Ne quittez pas la page !`
      );
      setRechargeFeedback(null);
    };

    setIsSubmittingRecharge(true);
    try {
      const safeEmailLocal = (user.id || 'client').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'client';
      const reqBody = {
        userId: user.id,
        transactionType: 'RECHARGE',
        amount: amountNum.toFixed(2),
        currency: rechargeCountryInfo.currency,
        country: rechargeCountryInfo.code,
        network: activeRechargeOp.id,
        phone: localRechargePhone,
        customerName: effectiveName,
        customerEmail: `${safeEmailLocal}@aviator-bot.com`,
        description: lockedBetId
          ? `Rechargement Solde Mobile Money (${amountNum} ${rechargeCountryInfo.currency}) · ID ${lockedBetId}`
          : `Rechargement Solde Mobile Money (${amountNum} ${rechargeCountryInfo.currency})`,
        vipTier: user.vipTier,
        bookmaker: user.bookmaker,
        bookmakerUserId: lockedBetId,
      };
      const res = await fetchWithResilience('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });

      const data = await parseJsonSafe(res);
      if (res.ok && data.success && data.transaction) {
        if (data.user) {
          onPaymentSuccess(data.user);
        }
        if (firebaseUser && data.transaction) {
          upsertTransactionToFirestore(
            { ...data.transaction, userId: firebaseUser.uid },
            { firebaseUid: firebaseUser.uid }
          ).catch(() => {});
          upsertOperationToFirestore(
            {
              id: `op_${data.transaction.id}`,
              userId: firebaseUser.uid,
              firebaseUid: firebaseUser.uid,
              userPhone: data.transaction.phone || localRechargePhone,
              type: 'RECHARGE',
              amount: amountNum,
              status: 'PENDING',
              title: 'Rechargement Mobile Money',
              description: data.transaction.description || 'Rechargement en attente',
              reference: data.transaction.id,
              createdAt: data.transaction.createdAt,
              updatedAt: data.transaction.updatedAt,
            },
            { firebaseUid: firebaseUser.uid }
          ).catch(() => {});
        }
        setPendingRechargeTx(data.transaction);
        writeLocalJson(rechargeTxStorageKey, data.transaction);
        writeLocalJson(rechargeConfirmedStorageKey, null);
        startRechargeCountdown();
        setRechargeConfirmedMessage('');
        setRechargePromptNotice(
          `Message de prélèvement et confirmation envoyés tout de suite sur ${data.transaction.phone} (${activeRechargeOp.name}). Ne quittez pas la page !`
        );
        setRechargeFeedback(null);
        performSync();
      } else {
        enterOfflineOrFallbackRechargeWait();
      }
    } catch {
      enterOfflineOrFallbackRechargeWait();
    } finally {
      setIsSubmittingRecharge(false);
    }
  };

  // Re-send Mobile Money debit push on Recharge screen (works with same number 2nd/Nth time)
  const handleResendRechargeDebit = async () => {
    if (!pendingRechargeTx || isResendingRecharge) return;
    setIsResendingRecharge(true);
    startRechargeCountdown();
    try {
      const res = await fetchWithResilience(
        `/api/payments/${encodeURIComponent(pendingRechargeTx.id)}/resend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: pendingRechargeTx.phone,
            country: pendingRechargeTx.country,
            network: pendingRechargeTx.network,
            customerName: pendingRechargeTx.customerName,
            fallbackTx: pendingRechargeTx,
          }),
        }
      );
      const data = await parseJsonSafe(res);
      if (res.ok && data.success && data.transaction) {
        setPendingRechargeTx(data.transaction);
        writeLocalJson(rechargeTxStorageKey, data.transaction);
        const count = Number(data.resendCount || data.transaction.resendCount || 1) + 1;
        setRechargePromptNotice(
          `Message de prélèvement renvoyé tout de suite sur ${data.transaction.phone} (${data.transaction.operatorName}) · Envoi #${count}.`
        );
      } else {
        const nextCount = (pendingRechargeTx.resendCount || 0) + 1;
        setRechargePromptNotice(
          `Message de prélèvement renvoyé tout de suite sur ${pendingRechargeTx.phone} (Envoi #${nextCount + 1}).`
        );
      }
      performSync();
    } catch {
      const nextCount = (pendingRechargeTx.resendCount || 0) + 1;
      setRechargePromptNotice(
        `Nouvelle confirmation de prélèvement enregistrée pour ${pendingRechargeTx.phone} (Envoi #${nextCount + 1}).`
      );
    } finally {
      setIsResendingRecharge(false);
    }
  };

  const handleConfirmRechargeDebit = async () => {
    if (!pendingRechargeTx) return;
    setIsConfirmingRecharge(true);
    const waitMsg =
      'Veuillez attendre que les administrateurs valident le dépôt sur votre compte du jeu Aviator.';
    try {
      await fetchWithResilience(
        `/api/payments/${encodeURIComponent(pendingRechargeTx.id)}/confirm-recharge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fallbackTx: pendingRechargeTx }),
        }
      );
    } catch {
      // proceed smoothly even on transient network
    } finally {
      setIsConfirmingRecharge(false);
      setRechargeConfirmedMessage(waitMsg);
      writeLocalJson(rechargeConfirmedStorageKey, { txId: pendingRechargeTx.id, message: waitMsg });
      performSync();
    }
  };

  // Launch Withdrawal Request (Minimum 5 000 FCFA, Admin validation required)
  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawFeedback(null);

    const activeWithdrawOp = withdrawOperator || withdrawCountryInfo.operators[0] || null;
    if (!activeWithdrawOp) {
      setWithdrawFeedback({
        type: 'error',
        text: 'Aucun réseau actif sélectionné pour la réception.',
      });
      return;
    }

    const localWithdrawPhone = extractLocalPhoneDigits(withdrawPhone, withdrawCountryInfo.phonePrefix);
    if (localWithdrawPhone.length < 7) {
      setWithdrawFeedback({
        type: 'error',
        text: 'Veuillez saisir un numéro Mobile Money de réception valide.',
      });
      return;
    }

    const amountNum = Math.floor(Number(String(withdrawAmount).replace(/\s+/g, '').replace(',', '.')));
    if (isNaN(amountNum) || amountNum < 5000) {
      setWithdrawFeedback({
        type: 'error',
        text: 'Le montant minimum pour effectuer un retrait est de 5 000 XOF.',
      });
      return;
    }
    if (amountNum > currentBalance) {
      setWithdrawFeedback({
        type: 'error',
        text: `Solde insuffisant (${currentBalance.toLocaleString('fr-FR')} XOF disponibles).`,
      });
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const formattedWithdrawPhone = `${withdrawCountryInfo.phonePrefix}${localWithdrawPhone}`;
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          phone: formattedWithdrawPhone,
          amount: amountNum,
          country: withdrawCountryInfo.code,
          network: activeWithdrawOp.id,
        }),
      });

      const data = await parseJsonSafe(res);
      if (res.ok && data.success) {
        if (data.user) onPaymentSuccess(data.user);
        if (firebaseUser && data.transaction) {
          upsertTransactionToFirestore(
            { ...data.transaction, userId: firebaseUser.uid },
            { firebaseUid: firebaseUser.uid }
          ).catch(() => {});
          upsertOperationToFirestore(
            {
              id: `op_${data.transaction.id}`,
              userId: firebaseUser.uid,
              firebaseUid: firebaseUser.uid,
              userPhone: formattedWithdrawPhone,
              type: 'WITHDRAWAL',
              amount: amountNum,
              status: 'PENDING',
              title: 'Retrait Mobile Money',
              description: data.transaction.description || 'Retrait en attente',
              reference: data.transaction.id,
              createdAt: data.transaction.createdAt,
              updatedAt: data.transaction.updatedAt,
            },
            { firebaseUid: firebaseUser.uid }
          ).catch(() => {});
        }
        setWithdrawFeedback({
          type: 'success',
          text: `Retrait de ${amountNum.toLocaleString('fr-FR')} XOF transmis à l’administrateur pour validation.`,
        });
        performSync();
      } else {
        setWithdrawFeedback({ type: 'error', text: data.message || 'Demande de retrait refusée.' });
      }
    } catch {
      setWithdrawFeedback({ type: 'error', text: 'Veuillez réessayer.' });
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // =========================================================================
  // RENDER: PAID VIP CLIENT -> LIVE AVIATOR & BOT + WALLET MOBILE INTERFACE
  // =========================================================================
  if (isPaid) {
    return (
      <div className="px-3 pt-3 pb-24 space-y-3">
        {/* Compact Account & Balance Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-700 font-bold uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {user.vipTier} ACTIF · {user.bookmaker}
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 truncate">{user.fullName}</div>
            <div className="text-[11px] font-mono text-slate-500">{user.phone}</div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-right">
              <span className="text-[9px] font-mono text-slate-400 block">SOLDE</span>
              <span className="font-mono font-black text-xs tabular-nums">
                {currentBalance.toLocaleString('fr-FR')} F
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center cursor-pointer"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Push Toast */}
        {liveAlert && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-xs ${
              liveAlert.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : liveAlert.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
          >
            <span>{liveAlert.message}</span>
            <button
              type="button"
              onClick={() => setLiveAlert(null)}
              className="p-1 cursor-pointer shrink-0"
            >
              <XCircle className="w-4 h-4 opacity-60" />
            </button>
          </div>
        )}

        {/* TAB 1: AVIATOR GAME & BOT SIGNAL */}
        {activeTab === 'aviator' && (
          <AviatorGameDashboard
            user={user}
            aviatorState={aviatorState}
            onUserUpdated={onPaymentSuccess}
            onGoToRecharge={() => setActiveTab('recharge')}
          />
        )}

        {/* TAB 2: RECHARGER MON SOLDE (VALIDATION ADMIN OBLIGATOIRE) */}
        {activeTab === 'recharge' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-700">
                  Dépôt Mobile Money Réel
                </span>
                <h2 className="text-base font-black text-slate-900">Recharger mon Solde</h2>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Solde actuel</span>
                <span className="font-mono font-black text-sm text-slate-900 tabular-nums">
                  {currentBalance.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Aucun dépôt fictif : votre rechargement est crédité automatiquement dès que l’administrateur confirme la réception sur Mobile Money.
              </span>
            </div>

            {rechargeConfirmedMessage ? (
              <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
                  <Hourglass className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black text-emerald-950">Dépôt confirmé</h3>
                  <p className="text-xs font-bold text-emerald-900 leading-relaxed">
                    {rechargeConfirmedMessage}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingRechargeTx(null);
                    setRechargeConfirmedMessage('');
                    setRechargePromptNotice('');
                    writeLocalJson(rechargeTxStorageKey, null);
                    writeLocalJson(rechargeConfirmedStorageKey, null);
                  }}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs cursor-pointer"
                >
                  Effectuer un autre rechargement
                </button>
              </div>
            ) : pendingRechargeTx ? (
              <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-200 space-y-4">
                <div className="flex items-center justify-between border-b border-blue-200/70 pb-2.5">
                  <span className="text-[11px] font-mono font-black text-blue-900 uppercase">
                    Prélèvement Automatique En Cours
                  </span>
                  <span className="text-xs font-mono font-black text-blue-800">
                    {pendingRechargeTx.amount.toLocaleString('fr-FR')} {pendingRechargeTx.currency}
                  </span>
                </div>

                {/* Live 60-Second Countdown & Do Not Leave Page Notice */}
                {rechargeCountdownSeconds > 0 ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-amber-950 font-black text-xs">
                        <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                        <span>Ne quittez pas la page de paiement</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 font-mono font-black text-sm tabular-nums shrink-0">
                        00:{String(rechargeCountdownSeconds).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, (rechargeCountdownSeconds / 60) * 100))}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-amber-900 leading-snug">
                      Un message de confirmation et de prélèvement Mobile Money ({pendingRechargeTx.operatorName} · {pendingRechargeTx.countryName}) va être envoyé tout de suite sur{' '}
                      <strong className="font-mono">{pendingRechargeTx.phone}</strong>. Patientez sur cette page ({rechargeCountdownSeconds}s).
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white border border-blue-300 space-y-1">
                    <div className="flex items-center justify-between text-xs font-black text-blue-950">
                      <span>Décompte de 60 secondes terminé</span>
                      <span className="font-mono text-blue-700">00:00</span>
                    </div>
                    <p className="text-[11px] text-blue-900 leading-snug">
                      Si le message de prélèvement ne s’est pas affiché sur votre téléphone, appuyez sur{' '}
                      <strong>« Renvoyer le message de prélèvement »</strong> ci-dessous.
                    </p>
                  </div>
                )}

                {rechargePromptNotice && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-[11px] font-bold text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{rechargePromptNotice}</span>
                  </div>
                )}

                <div className="text-xs text-slate-800 space-y-2 leading-relaxed">
                  <p>
                    Une demande de <strong>prélèvement automatique {pendingRechargeTx.operatorName}</strong> a été envoyée sur votre numéro{' '}
                    <strong className="font-mono">{pendingRechargeTx.phone}</strong>.
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Validez le débit sur votre téléphone avec votre code PIN Mobile Money, puis cliquez sur le bouton ci-dessous. Si le message ne s’est pas affiché, utilisez « Renvoyer le message de prélèvement ».
                  </p>
                </div>

                {Boolean(pendingRechargeTx.apiResponse?.data?.instructions) && (
                  <div className="p-2.5 rounded-xl bg-white border border-blue-200 text-[11px] font-medium text-slate-700">
                    {formatGatewayInstructions(pendingRechargeTx.apiResponse?.data?.instructions)}
                  </div>
                )}

                {pendingRechargeTx.apiResponse?.data?.checkout_url && (
                  <a
                    href={pendingRechargeTx.apiResponse.data.checkout_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <span>Ouvrir le lien de confirmation opérateur</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isConfirmingRecharge}
                    onClick={handleConfirmRechargeDebit}
                    className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {isConfirmingRecharge ? 'Confirmation...' : 'J’ai confirmé le prélèvement'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isResendingRecharge}
                    onClick={handleResendRechargeDebit}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResendingRecharge ? 'animate-spin' : ''}`} />
                    <span>
                      {isResendingRecharge
                        ? 'Renvoi en cours...'
                        : 'Renvoyer le message de prélèvement'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (pendingRechargeTx?.id) {
                        const existingQueue = readLocalJson<Array<{ localId: string; body: Record<string, unknown> }>>(
                          queuedPaymentsStorageKey
                        );
                        if (Array.isArray(existingQueue) && existingQueue.length > 0) {
                          const filtered = existingQueue.filter((q) => q.localId !== pendingRechargeTx.id);
                          writeLocalJson(queuedPaymentsStorageKey, filtered.length > 0 ? filtered : null);
                        }
                      }
                      setPendingRechargeTx(null);
                      setRechargeFeedback(null);
                      setRechargePromptNotice('');
                      writeLocalJson(rechargeTxStorageKey, null);
                      clearRechargeCountdown();
                    }}
                    className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Retour / Modifier le numéro ou le montant</span>
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleLaunchRecharge} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Montant à recharger (FCFA)
                </label>
                <input
                  type="number"
                  min={500}
                  step={100}
                  required
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[1000, 2000, 5000, 10000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRechargeAmount(String(val))}
                      className={`py-2 rounded-xl text-xs font-mono font-bold border cursor-pointer ${
                        Number(rechargeAmount) === val
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {val.toLocaleString('fr-FR')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Nom complet du payeur (Optionnel)
                </label>
                <input
                  type="text"
                  value={rechargeCustomerName}
                  onChange={(e) => setRechargeCustomerName(e.target.value)}
                  placeholder="Ex: Kouamé Jean-Marc (optionnel)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Pays UEMOA · Devise XOF ({rechargeCountryInfo.flag} {rechargeCountryInfo.currency})
                </label>
                <select
                  value={rechargeCountryCode}
                  onChange={(e) => {
                    const nextCode = e.target.value as CountryCode;
                    setRechargeCountryCode(nextCode);
                    const nextCountry = SUPPORTED_COUNTRIES[nextCode];
                    setRechargeOperator(nextCountry.operators[0] || null);
                    setRechargeFeedback(null);
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  {COUNTRIES_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.currency}) — {c.operators.map((o) => o.name).join(', ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Réseaux SASPay disponibles ({rechargeCountryInfo.flag} {rechargeCountryInfo.name} · {rechargeCountryInfo.currency})
                </label>
                {rechargeCountryInfo.operators.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {rechargeCountryInfo.operators.map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setRechargeOperator(op);
                          setRechargeFeedback(null);
                        }}
                        className={`p-2.5 rounded-xl border-2 text-left text-xs font-bold cursor-pointer flex items-center justify-between ${
                          rechargeOperator?.id === op.id
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{op.name}</span>
                        {rechargeOperator?.id === op.id && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    {rechargeCountryInfo.gatewayNote || 'Aucun réseau Mobile Money actif sur SASPay pour ce pays.'}
                  </div>
                )}
                {rechargeCountryInfo.gatewayNote && rechargeCountryInfo.operators.length > 0 && (
                  <span className="text-[10px] text-slate-500 mt-1 block">{rechargeCountryInfo.gatewayNote}</span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  {user.bookmakerUserId && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                  <span>
                    ID de votre compte {user.bookmaker}{' '}
                    {user.bookmakerUserId ? '(Enregistré · Immodifiable)' : '(Optionnel)'}
                  </span>
                </label>
                {user.bookmakerUserId ? (
                  <>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={user.bookmakerUserId}
                        className="w-full px-3.5 py-2.5 pr-10 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      ID verrouillé depuis votre inscription (immodifiable).
                    </span>
                  </>
                ) : (
                  <input
                    type="text"
                    value={depositBookmakerId}
                    onChange={(e) => setDepositBookmakerId(e.target.value)}
                    placeholder="Ex: 849201453 (optionnel)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Numéro Mobile Money ({rechargeCountryInfo.phonePrefix})
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-xs font-mono font-bold text-slate-700">
                    {rechargeCountryInfo.flag} {rechargeCountryInfo.phonePrefix}
                  </span>
                  <input
                    type="tel"
                    required
                    value={rechargePhone}
                    onChange={(e) => setRechargePhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-r-xl font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                    placeholder={rechargeCountryInfo.phonePlaceholder}
                  />
                </div>
              </div>

              {rechargeFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                    rechargeFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {rechargeFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{rechargeFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingRecharge || !rechargeOperator}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {isSubmittingRecharge
                    ? 'Envoi rapide · Ne quittez pas...'
                    : `Lancer Prélèvement ${Number(rechargeAmount || 0).toLocaleString('fr-FR')} ${rechargeCountryInfo.currency}`}
                </span>
              </button>
              {isSubmittingRecharge && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900 text-center">
                  Ne quittez pas la page de paiement — envoi immédiat du message de prélèvement...
                </div>
              )}
            </form>
            )}
          </div>
        )}

        {/* TAB 3: RETIRER MES GAINS (MINIMUM 5 000 FCFA, VALIDATION ADMIN) */}
        {activeTab === 'withdraw' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-blue-700">
                  Retrait Mobile Money
                </span>
                <h2 className="text-base font-black text-slate-900">Retirer mes Gains</h2>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Disponible</span>
                <span className="font-mono font-black text-sm text-emerald-700 tabular-nums">
                  {currentBalance.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <span>
                <strong>Minimum de retrait : 5 000 FCFA.</strong> Chaque retrait est vérifié et validé depuis le compte administrateur avant l'envoi sur votre téléphone.
              </span>
            </div>

            <form onSubmit={handleRequestWithdrawal} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Montant à retirer (min. 5 000 FCFA)
                </label>
                <input
                  type="number"
                  min={5000}
                  step={500}
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {[5000, 10000, 25000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setWithdrawAmount(String(val))}
                      className={`py-2 rounded-xl text-xs font-mono font-bold border cursor-pointer ${
                        Number(withdrawAmount) === val
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {val.toLocaleString('fr-FR')} F
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Pays de réception ({withdrawCountryInfo.flag} {withdrawCountryInfo.currency})
                </label>
                <select
                  value={withdrawCountryCode}
                  onChange={(e) => {
                    const nextCode = e.target.value as CountryCode;
                    setWithdrawCountryCode(nextCode);
                    const nextCountry = SUPPORTED_COUNTRIES[nextCode];
                    setWithdrawOperator(nextCountry.operators[0] || null);
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  {COUNTRIES_LIST.filter((c) => c.operators.length > 0).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Opérateur de réception
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {withdrawCountryInfo.operators.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setWithdrawOperator(op)}
                      className={`p-2.5 rounded-xl border-2 text-left text-xs font-bold cursor-pointer flex items-center justify-between ${
                        withdrawOperator?.id === op.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{op.name}</span>
                      {withdrawOperator?.id === op.id && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Numéro de réception Mobile Money
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-xs font-mono font-bold text-slate-700">
                    {withdrawCountryInfo.flag} {withdrawCountryInfo.phonePrefix}
                  </span>
                  <input
                    type="tel"
                    required
                    value={withdrawPhone}
                    onChange={(e) => setWithdrawPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-r-xl font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder={withdrawCountryInfo.phonePlaceholder}
                  />
                </div>
              </div>

              {withdrawFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                    withdrawFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {withdrawFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{withdrawFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingWithdraw || !withdrawOperator}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>
                  {isSubmittingWithdraw
                    ? 'Transmission en cours...'
                    : `Demander Retrait ${Number(withdrawAmount || 0).toLocaleString('fr-FR')} ${withdrawCountryInfo.currency}`}
                </span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: HISTORIQUE COMPLET & PERMANENT DES OPÉRATIONS */}
        {activeTab === 'operations' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <div>
                  <h2 className="text-sm font-black text-slate-900">Mes Opérations</h2>
                  <p className="text-[11px] text-slate-500">Synchronisation automatique permanente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={performSync}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                title="Actualiser"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {clientOperations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-1.5">
                <Clock className="w-6 h-6 mx-auto text-slate-400" />
                <p>Aucune opération enregistrée pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {clientOperations.map((op) => {
                  const isSuccess = op.status === 'SUCCESS';
                  const isPending = op.status === 'PENDING';
                  const sign = op.type === 'WIN' || op.type === 'RECHARGE' ? '+' : op.type === 'WITHDRAWAL' || op.type === 'BET' ? '-' : '';
                  return (
                    <div
                      key={op.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        isSuccess
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : isPending
                          ? 'bg-amber-50/50 border-amber-300'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{op.title}</div>
                          <div className="text-[11px] text-slate-600 leading-snug">{op.description}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`font-mono font-black text-sm tabular-nums ${
                              isSuccess
                                ? 'text-emerald-700'
                                : isPending
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {sign}
                            {op.amount.toLocaleString('fr-FR')} F
                          </div>
                          <span
                            className={`inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                              isSuccess
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPending
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isSuccess ? 'VALIDÉ' : isPending ? 'EN ATTENTE' : 'REJETÉ'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>{new Date(op.updatedAt || op.createdAt).toLocaleString('fr-FR')}</span>
                        {op.reference && <span className="truncate max-w-[140px]">Réf: {op.reference}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MOBILE FIXED BOTTOM NAVIGATION BAR (TOUCH TARGETS >= 48px) */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 grid grid-cols-4 gap-1 shadow-lg">
          <button
            type="button"
            onClick={() => setActiveTab('aviator')}
            className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
              activeTab === 'aviator' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Plane className="w-4 h-4" />
            <span>Aviator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recharge')}
            className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
              activeTab === 'recharge' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Recharger</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('withdraw')}
            className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
              activeTab === 'withdraw' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Retirer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('operations')}
            className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
              activeTab === 'operations' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Opérations</span>
          </button>
        </nav>
      </div>
    );
  }

  // =========================================================================
  // RENDER: UNPAID / PENDING VIP ACTIVATION SCREEN (MOBILE-ONLY)
  // =========================================================================
  return (
    <div className="px-3 py-4 space-y-4">
      <ClientVideoSection />

      {/* Welcome & Status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-slate-500 truncate">
              {vipCountryInfo.flag} {vipCountryInfo.name} ({vipCountryInfo.currency}) · <strong className="text-blue-700">{user.bookmaker}</strong>
            </div>
            <h1 className="text-lg font-black text-slate-900 truncate">Bienvenue, {user.fullName}</h1>
            <p className="text-[11px] font-mono text-slate-600">{user.phone}</p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center shrink-0 cursor-pointer"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-mono font-bold flex items-center gap-2">
          {isWaitingAdminApproval ? (
            <>
              <Hourglass className="w-4 h-4 text-amber-700 shrink-0" />
              <span>EN ATTENTE DE VALIDATION ADMIN</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>PLACE RÉSERVÉE · ACTIVATION VIP REQUISE</span>
            </>
          )}
        </div>
      </div>

      {liveAlert && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            liveAlert.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <span>{liveAlert.message}</span>
          <button type="button" onClick={() => setLiveAlert(null)} className="cursor-pointer">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VIP Confirmation & SMS Screenshot Proof Screen (VIP Subscription ONLY) */}
      {isWaitingAdminApproval && currentTransaction ? (
        <div className="bg-white border-2 border-amber-300 rounded-2xl p-4 shadow-md space-y-4">
          <div className="flex items-center justify-between text-[11px] font-mono border-b border-slate-100 pb-2.5">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              PREUVE DE PAIEMENT VIP
            </span>
            <span className="text-slate-500">Réf: {currentTransaction.id}</span>
          </div>

          {/* Live 60-Second Countdown & Do Not Leave Page Notice */}
          {vipCountdownSeconds > 0 ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-amber-950 font-black text-xs">
                  <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                  <span>Ne quittez pas la page de paiement</span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 font-mono font-black text-sm tabular-nums shrink-0">
                  00:{String(vipCountdownSeconds).padStart(2, '0')}
                </span>
              </div>
              <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, (vipCountdownSeconds / 60) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] font-semibold text-amber-900 leading-snug">
                Un message de confirmation et de prélèvement Mobile Money ({currentTransaction.operatorName} · {currentTransaction.countryName}) va être envoyé tout de suite sur{' '}
                <strong className="font-mono">{currentTransaction.phone}</strong>. Patientez sur cette page ({vipCountdownSeconds}s).
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
              <div className="flex items-center justify-between text-xs font-black text-blue-950">
                <span>Décompte de 60 secondes terminé</span>
                <span className="font-mono text-blue-700">00:00</span>
              </div>
              <p className="text-[11px] text-blue-900 leading-snug">
                Si le message de prélèvement ne s’est pas affiché sur votre téléphone, appuyez sur{' '}
                <strong>« Renvoyer le message de prélèvement »</strong> ci-dessous.
              </p>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
            <div className="font-bold text-amber-950">
              Paiement {selectedVip} · {currentTransaction.amount.toLocaleString('fr-FR')} {currentTransaction.currency}
            </div>
            <p className="text-slate-700 leading-relaxed">
              Opérateur : <strong>{currentTransaction.operatorName}</strong> (<span className="font-mono">{currentTransaction.phone}</span>). Validez le message de prélèvement sur votre téléphone puis importez la <strong>capture d’écran du SMS de confirmation</strong> ci-dessous.
            </p>
          </div>

          {vipPromptNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-[11px] font-bold text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{vipPromptNotice}</span>
            </div>
          )}

          {Boolean(currentTransaction.apiResponse?.data?.instructions) && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-700">
              {formatGatewayInstructions(currentTransaction.apiResponse?.data?.instructions)}
            </div>
          )}

          {currentTransaction.apiResponse?.data?.checkout_url && (
            <a
              href={currentTransaction.apiResponse.data.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
            >
              <span>Ouvrir le lien de confirmation opérateur</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          )}

          {!currentTransaction.hasPaymentProof && (
            <button
              type="button"
              disabled={isResendingVip}
              onClick={handleResendVipDebit}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResendingVip ? 'animate-spin' : ''}`} />
              <span>
                {isResendingVip
                  ? 'Renvoi de la confirmation...'
                  : 'Renvoyer le message de prélèvement'}
              </span>
            </button>
          )}

          {currentTransaction.hasPaymentProof && !isReplacingProof ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                <FileCheck2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Preuve SMS soumise avec succès !</span>
              </div>

              {(smsProofDataUrl || currentTransaction.paymentProofUrl) && (
                <div className="rounded-xl overflow-hidden border border-emerald-200 bg-white p-1.5">
                  <img
                    src={smsProofDataUrl || currentTransaction.paymentProofUrl}
                    alt="Capture SMS de confirmation"
                    className="w-full max-h-64 object-contain rounded-lg"
                  />
                </div>
              )}

              <p className="text-[11px] text-emerald-900 leading-relaxed">
                Votre capture d’écran du SMS de confirmation est transmise dans le menu administrateur. Dès acceptation, votre espace Aviator & Code 15 s’ouvrira automatiquement.
              </p>

              <button
                type="button"
                onClick={() => setIsReplacingProof(true)}
                className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-bold cursor-pointer"
              >
                Remplacer la capture d’écran SMS
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Importer la capture d’écran du SMS de confirmation du paiement
                </span>
                <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 rounded-2xl p-4 text-center cursor-pointer transition-colors space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSmsFileSelect}
                    className="hidden"
                  />
                  {smsProofDataUrl ? (
                    <div className="space-y-2">
                      <img
                        src={smsProofDataUrl}
                        alt="Aperçu capture SMS"
                        className="w-full max-h-56 object-contain rounded-xl border border-emerald-200 bg-white mx-auto"
                      />
                      <div className="text-[11px] font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>{smsProofFileName || 'Capture SMS prête'} · Cliquer pour changer</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 space-y-1.5">
                      <Upload className="w-7 h-7 text-emerald-600 mx-auto" />
                      <div className="text-xs font-bold text-slate-900">
                        Appuyez ici pour importer la capture d’écran du SMS
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Formats acceptés : PNG, JPG, WEBP (SMS Mobile Money visible)
                      </div>
                    </div>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsConfirmedChecked}
                  onChange={(e) => {
                    setSmsConfirmedChecked(e.target.checked);
                    setSmsProofError('');
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                />
                <span className="text-[11px] text-slate-700 leading-snug font-medium">
                  Je certifie que cette image est bien la capture d’écran officielle du SMS de confirmation de paiement Mobile Money reçu.
                </span>
              </label>

              {smsProofError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{smsProofError}</span>
                </div>
              )}

              <button
                type="button"
                disabled={isUploadingProof || !smsProofDataUrl}
                onClick={handleSubmitVipProof}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>
                  {isUploadingProof ? 'Envoi de la preuve...' : 'Soumettre la preuve de paiement'}
                </span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (currentTransaction?.id) {
                dismissedPendingTxIdsRef.current.add(currentTransaction.id);
                const existingQueue = readLocalJson<Array<{ localId: string; body: Record<string, unknown> }>>(
                  queuedPaymentsStorageKey
                );
                if (Array.isArray(existingQueue) && existingQueue.length > 0) {
                  const filtered = existingQueue.filter((q) => q.localId !== currentTransaction.id);
                  writeLocalJson(queuedPaymentsStorageKey, filtered.length > 0 ? filtered : null);
                }
              }
              clientTransactions.forEach((t) => {
                if (t.status === 'PENDING' && (!t.transactionType || t.transactionType === 'VIP_ACTIVATION')) {
                  dismissedPendingTxIdsRef.current.add(t.id);
                }
              });
              writeLocalJson(vipTxStorageKey, null);
              clearVipCountdown();
              setIsWaitingAdminApproval(false);
              setCurrentTransaction(null);
              setVipPromptNotice('');
              setSmsProofDataUrl(null);
              setSmsProofError('');
              setPaymentError('');
            }}
            className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour / Modifier le numéro ou le paiement</span>
          </button>
        </div>
      ) : (
        /* VIP Plan Selection + 8-Country XOF Mobile Money Checkout Form */
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {/* VIP 1 */}
            <div
              onClick={() => setSelectedVip('VIP1')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                selectedVip === 'VIP1'
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase block">
                    Garanti 100% Sûr · Capital 500 à 50 000 F
                  </span>
                  <h3 className="text-base font-black text-slate-900">VIP 1 · 1.50x à 49.00x</h3>
                </div>
                <span className="font-mono font-black text-lg text-emerald-700">550 XOF</span>
              </div>
              <div className="text-[11px] text-slate-600">
                Accès direct au Jeu Aviator, Code 15 exact 15s avant chaque vol et retraits Mobile Money.
              </div>
            </div>

            {/* VIP 2 */}
            <div
              onClick={() => setSelectedVip('VIP2')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                selectedVip === 'VIP2'
                  ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-700 uppercase block">
                    Garanti 100% Sûr · Capital 50 000 à 100 000 F
                  </span>
                  <h3 className="text-base font-black text-slate-900">VIP 2 · 49.00x à 100.00x+</h3>
                </div>
                <span className="font-mono font-black text-lg text-blue-700">1 500 XOF</span>
              </div>
              <div className="text-[11px] text-slate-600">
                Signaux hautes cotes prioritaires, Code 15 en direct et support prioritaire.
              </div>
            </div>
          </div>

          {/* Mobile Money Checkout (8 XOF UEMOA Countries + Mandatory Full Name + Phone) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
            <div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase">
                Paiement Mobile Money Zone UEMOA ({vipCountryInfo.currency})
              </span>
              <h3 className="text-sm font-black text-slate-900">
                Activer {selectedVip} · {currentAmount} {vipCountryInfo.currency}
              </h3>
            </div>

            {/* 8 XOF Countries Directory Card */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Pays de paiement (8 pays Zone CFA XOF)
              </label>
              <select
                value={vipCountryCode}
                onChange={(e) => {
                  const nextCode = e.target.value as CountryCode;
                  setVipCountryCode(nextCode);
                  const nextCountry = SUPPORTED_COUNTRIES[nextCode];
                  setSelectedOperator(nextCountry.operators[0] || null);
                  setPaymentError('');
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                {COUNTRIES_LIST.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.currency}) — {c.operators.map((o) => o.name).join(', ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Active SasPay Operators for selected country */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Réseau disponible ({vipCountryInfo.flag} {vipCountryInfo.name} · {vipCountryInfo.currency})
              </label>
              {vipCountryInfo.operators.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {vipCountryInfo.operators.map((op) => {
                    const isSelected = selectedOperator?.id === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setSelectedOperator(op);
                          setPaymentError('');
                        }}
                        className={`p-2.5 rounded-xl border-2 text-left text-xs font-bold cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{op.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  {vipCountryInfo.gatewayNote || 'Aucun réseau actif pour ce pays.'}
                </div>
              )}
              {vipCountryInfo.gatewayNote && vipCountryInfo.operators.length > 0 && (
                <span className="text-[10px] text-slate-500 block">{vipCountryInfo.gatewayNote}</span>
              )}
            </div>

            {/* Optional Full Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Nom complet du client (Optionnel)
              </label>
              <input
                type="text"
                value={vipCustomerName}
                onChange={(e) => setVipCustomerName(e.target.value)}
                placeholder="Ex: Kouamé Jean-Marc (optionnel)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                {user.bookmakerUserId && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                <span>
                  ID de votre compte {user.bookmaker}{' '}
                  {user.bookmakerUserId ? '(Enregistré · Immodifiable)' : '(Optionnel)'}
                </span>
              </label>
              {user.bookmakerUserId ? (
                <>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={user.bookmakerUserId}
                      className="w-full px-3.5 py-2.5 pr-10 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    ID verrouillé depuis votre inscription (immodifiable).
                  </span>
                </>
              ) : (
                <input
                  type="text"
                  value={vipBookmakerId}
                  onChange={(e) => setVipBookmakerId(e.target.value)}
                  placeholder="Ex: 849201453 (optionnel)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Numéro Mobile Money {selectedOperator ? `(${selectedOperator.name})` : ''} · Obligatoire
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-xs font-mono font-bold text-slate-700">
                  {vipCountryInfo.flag} {vipCountryInfo.phonePrefix}
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={vipCountryInfo.phonePlaceholder}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-r-xl font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
              {selectedOperator && (
                <span className="text-[11px] text-slate-500 mt-1 block">{selectedOperator.instructionFr}</span>
              )}
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleLaunchVipPayment}
              disabled={isPaying || isWaitingAdminApproval || !selectedOperator}
              className="w-full min-h-[50px] py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Smartphone className="w-4 h-4" />
              <span>
                {isPaying
                  ? 'Envoi rapide · Ne quittez pas...'
                  : `Payer ${currentAmount} ${vipCountryInfo.currency} (${selectedVip})`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
            {isPaying && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900 text-center">
                Ne quittez pas la page de paiement — envoi immédiat du message de prélèvement...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent Client Operations History (always saved & visible) */}
      {(clientOperations.length > 0 || clientTransactions.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-600" />
              Historique Opérations
            </h3>
            <span className="text-[10px] font-mono text-slate-500">
              {clientOperations.length} opération(s)
            </span>
          </div>

          <div className="space-y-2">
            {clientOperations.map((op) => (
              <div
                key={op.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{op.title}</div>
                  <div className="text-[10px] text-slate-500 truncate">{op.description}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-slate-900">{op.amount.toLocaleString('fr-FR')} F</div>
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      op.status === 'SUCCESS'
                        ? 'text-emerald-700'
                        : op.status === 'PENDING'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {op.status === 'SUCCESS' ? 'VALIDÉ' : op.status === 'PENDING' ? 'EN ATTENTE' : 'REJETÉ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
