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
  Wallet,
} from 'lucide-react';

interface ClientAccountProps {
  user: User;
  onPaymentSuccess: (updatedUser: User) => void;
  onLogout: () => void;
}

type ClientTab = 'aviator' | 'recharge' | 'withdraw' | 'operations';

export const ClientAccount: React.FC<ClientAccountProps> = ({
  user,
  onPaymentSuccess,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<ClientTab>('aviator');
  const [selectedVip, setSelectedVip] = useState<VIPPlanId>(user.vipTier || 'VIP1');

  // Country & active SasPay operators across all 8 UEMOA XOF countries
  const initialCountryCode: CountryCode = resolveCountryCode(user.country);

  const [vipCountryCode, setVipCountryCode] = useState<CountryCode>(initialCountryCode);
  const vipCountryInfo: CountryInfo = SUPPORTED_COUNTRIES[vipCountryCode] || SUPPORTED_COUNTRIES.BJ;
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(
    vipCountryInfo.operators[0] || null
  );
  const [vipCustomerName, setVipCustomerName] = useState(user.fullName || '');
  const [phone, setPhone] = useState(user.phone.replace(/[^0-9]/g, '').slice(-10) || '');
  const [vipBookmakerId, setVipBookmakerId] = useState(user.bookmakerUserId || '');

  // VIP Activation Checkout state
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [currentTransaction, setCurrentTransaction] = useState<TransactionRecord | null>(null);
  const [isWaitingAdminApproval, setIsWaitingAdminApproval] = useState(false);
  const [countdown, setCountdown] = useState<number>(60);
  const [hasUserConfirmedOnPhone, setHasUserConfirmedOnPhone] = useState(false);

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
  const [rechargePhone, setRechargePhone] = useState(user.phone.replace(/[^0-9]/g, '').slice(-10) || '');
  const [depositBookmakerId, setDepositBookmakerId] = useState(user.bookmakerUserId || '');
  const [isSubmittingRecharge, setIsSubmittingRecharge] = useState(false);
  const [rechargeFeedback, setRechargeFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Wallet Withdrawal state (Minimum strictly 5 000 FCFA -> Admin validation required)
  const [withdrawCountryCode, setWithdrawCountryCode] = useState<CountryCode>(initialCountryCode);
  const withdrawCountryInfo: CountryInfo = SUPPORTED_COUNTRIES[withdrawCountryCode] || SUPPORTED_COUNTRIES.BJ;
  const [withdrawAmount, setWithdrawAmount] = useState<string>('5000');
  const [withdrawOperator, setWithdrawOperator] = useState<Operator | null>(
    withdrawCountryInfo.operators[0] || null
  );
  const [withdrawPhone, setWithdrawPhone] = useState(user.phone.replace(/[^0-9]/g, '').slice(-10) || '');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const userRef = useRef(user);
  userRef.current = user;

  // Keep bookmaker ID and payer name synced cleanly if updated from server
  useEffect(() => {
    if (user.bookmakerUserId) {
      setVipBookmakerId((prev) => prev || user.bookmakerUserId || '');
      setDepositBookmakerId((prev) => prev || user.bookmakerUserId || '');
    }
    if (user.fullName) {
      setVipCustomerName((prev) => prev || user.fullName);
      setRechargeCustomerName((prev) => prev || user.fullName);
    }
  }, [user.bookmakerUserId, user.fullName]);

  const vip1Price = 550;
  const vip2Price = 1500;
  const currentAmount = selectedVip === 'VIP1' ? vip1Price : vip2Price;
  const isPaid = user.paymentStatus === 'paid';
  const currentBalance = typeof user.balance === 'number' ? user.balance : 0;

  // 60-second timer countdown for VIP checkout
  useEffect(() => {
    if (!isWaitingAdminApproval || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isWaitingAdminApproval, countdown]);

  // Full server synchronization (recover offline & online decisions seamlessly)
  const performSync = useCallback(async () => {
    try {
      const identifier = userRef.current.id || userRef.current.phone;
      const res = await fetch(`/api/users/sync/${encodeURIComponent(identifier)}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.user && data.user.id === userRef.current.id) {
        const serverUser: User = data.user;
        const prevUser = userRef.current;

        if (serverUser.paymentStatus === 'paid' && prevUser.paymentStatus !== 'paid') {
          setIsWaitingAdminApproval(false);
          setActiveTab('aviator');
          setLiveAlert({
            type: 'success',
            message: 'Paiement VIP confirmé par l’administrateur ! Votre jeu Aviator & Code 15 est actif.',
          });
          onPaymentSuccess(serverUser);
        } else if (
          serverUser.vipTier !== prevUser.vipTier ||
          serverUser.paymentStatus !== prevUser.paymentStatus ||
          serverUser.bookmakerUserId !== prevUser.bookmakerUserId ||
          (serverUser.balance ?? 0) !== (prevUser.balance ?? 0)
        ) {
          onPaymentSuccess(serverUser);
        }
      }

      if (Array.isArray(data.transactions)) {
        setClientTransactions(data.transactions);
        if (userRef.current.paymentStatus !== 'paid') {
          const pendingVipTx = data.transactions.find(
            (t: TransactionRecord) =>
              t.status === 'PENDING' && (!t.transactionType || t.transactionType === 'VIP_ACTIVATION')
          );
          if (pendingVipTx) {
            setCurrentTransaction(pendingVipTx);
            setIsWaitingAdminApproval(true);
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
      // Ignore transient network errors
    }
  }, [onPaymentSuccess]);

  // Real-time SSE connection + periodic safety sync
  useEffect(() => {
    performSync();

    const sseUrl = `/api/events/stream?userId=${encodeURIComponent(user.id)}&userPhone=${encodeURIComponent(
      user.phone
    )}&role=client`;
    const eventSource = new EventSource(sseUrl);

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
          if (updated.paymentStatus === 'paid' && userRef.current.paymentStatus !== 'paid') {
            setIsWaitingAdminApproval(false);
            setActiveTab('aviator');
            setLiveAlert({
              type: 'success',
              message: 'Validation reçue ! Votre accès Aviator & Code 15 vient d’être débloqué instantanément.',
            });
          } else if (payload.transactionType === 'RECHARGE' && payload.decision === 'ACCEPT') {
            setLiveAlert({
              type: 'success',
              message: `Rechargement validé : +${Number(payload.transaction?.amount || 0).toLocaleString('fr-FR')} FCFA ajoutés à votre solde !`,
            });
          } else if (payload.transactionType === 'WITHDRAWAL' && payload.decision === 'ACCEPT') {
            setLiveAlert({
              type: 'success',
              message: `Retrait validé et payé : ${Number(payload.transaction?.amount || 0).toLocaleString('fr-FR')} FCFA envoyés sur votre numéro.`,
            });
          } else if (payload.decision === 'REJECT') {
            setIsWaitingAdminApproval(false);
            setCurrentTransaction(null);
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

    const fallbackInterval = setInterval(performSync, 5000);

    return () => {
      eventSource.close();
      clearInterval(fallbackInterval);
    };
  }, [user.id, user.phone, performSync, onPaymentSuccess]);

  // Launch VIP Activation Payment (Mandatory full name + phone, strict userId binding)
  const handleLaunchVipPayment = async () => {
    setPaymentError('');
    const cleanName = vipCustomerName.trim();
    if (cleanName.length < 2) {
      setPaymentError('Veuillez obligatoirement saisir votre nom complet avant de payer.');
      return;
    }

    if (!selectedOperator) {
      setPaymentError(
        vipCountryInfo.gatewayNote || 'Aucun réseau Mobile Money actif disponible pour ce pays.'
      );
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 6) {
      setPaymentError('Veuillez saisir un numéro Mobile Money valide.');
      return;
    }

    const cleanBetId = vipBookmakerId.replace(/\s+/g, '').trim();
    if (!cleanBetId) {
      setPaymentError(`Veuillez saisir votre ID de compte ${user.bookmaker} inscrit lors de l’inscription.`);
      return;
    }

    if (user.bookmakerUserId && user.bookmakerUserId.replace(/\s+/g, '').trim() !== cleanBetId) {
      setPaymentError(`Cet ID ne correspond pas à l’ID enregistré lors de votre inscription (${user.bookmakerUserId}).`);
      return;
    }

    setIsPaying(true);

    try {
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          transactionType: 'VIP_ACTIVATION',
          amount: currentAmount.toFixed(2),
          currency: vipCountryInfo.currency,
          country: vipCountryInfo.code,
          network: selectedOperator.id,
          phone: phone,
          customerName: cleanName,
          customerEmail: `${user.id}@aviator-bot.com`,
          description: `Paiement ${selectedVip} Bot Aviator (${currentAmount} ${vipCountryInfo.currency})`,
          vipTier: selectedVip,
          bookmaker: user.bookmaker,
          bookmakerUserId: vipBookmakerId.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        if (data.user && data.user.id === user.id) {
          onPaymentSuccess(data.user);
        }
        setCurrentTransaction(data.transaction);
        setIsWaitingAdminApproval(true);
        setCountdown(60);
        setHasUserConfirmedOnPhone(false);
        performSync();
      } else {
        setPaymentError(data.message || 'Veuillez vérifier vos informations et réessayer.');
      }
    } catch {
      setPaymentError('Connexion interrompue. Veuillez réessayer.');
    } finally {
      setIsPaying(false);
    }
  };

  // Launch Balance Recharge (Mandatory full name + phone + Bookmaker ID + Admin confirmation)
  const handleLaunchRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setRechargeFeedback(null);

    const cleanName = rechargeCustomerName.trim();
    if (cleanName.length < 2) {
      setRechargeFeedback({
        type: 'error',
        text: 'Veuillez obligatoirement saisir votre nom complet avant de lancer le paiement.',
      });
      return;
    }

    if (!rechargeOperator) {
      setRechargeFeedback({
        type: 'error',
        text: rechargeCountryInfo.gatewayNote || 'Aucun réseau Mobile Money actif disponible pour ce pays.',
      });
      return;
    }

    const cleanRechargePhone = rechargePhone.replace(/[^0-9]/g, '');
    if (cleanRechargePhone.length < 6) {
      setRechargeFeedback({ type: 'error', text: 'Veuillez saisir un numéro Mobile Money valide.' });
      return;
    }

    const amountNum = Math.floor(Number(rechargeAmount));
    if (isNaN(amountNum) || amountNum < 500) {
      setRechargeFeedback({ type: 'error', text: 'Montant minimum de rechargement : 500 XOF.' });
      return;
    }

    const cleanBetId = depositBookmakerId.replace(/\s+/g, '').trim();
    if (!cleanBetId) {
      setRechargeFeedback({
        type: 'error',
        text: `Veuillez entrer l’ID de votre compte ${user.bookmaker} inscrit lors de l’inscription avant le dépôt.`,
      });
      return;
    }

    if (user.bookmakerUserId && user.bookmakerUserId.replace(/\s+/g, '').trim() !== cleanBetId) {
      setRechargeFeedback({
        type: 'error',
        text: `L’ID saisi ne correspond pas à votre ID d’inscription (${user.bookmakerUserId}).`,
      });
      return;
    }

    setIsSubmittingRecharge(true);
    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          transactionType: 'RECHARGE',
          amount: amountNum.toFixed(2),
          currency: rechargeCountryInfo.currency,
          country: rechargeCountryInfo.code,
          network: rechargeOperator.id,
          phone: rechargePhone,
          customerName: cleanName,
          customerEmail: `${user.id}@aviator-bot.com`,
          description: `Rechargement Solde Mobile Money (${amountNum} ${rechargeCountryInfo.currency}) · ID ${cleanBetId}`,
          vipTier: user.vipTier,
          bookmaker: user.bookmaker,
          bookmakerUserId: depositBookmakerId.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user && data.user.id === user.id) {
          onPaymentSuccess(data.user);
        }
        setRechargeFeedback({
          type: 'success',
          text: `Demande de ${amountNum.toLocaleString('fr-FR')} ${rechargeCountryInfo.currency} envoyée (${rechargeOperator.name}). Votre solde sera crédité dès confirmation par l’administrateur.`,
        });
        performSync();
      } else {
        setRechargeFeedback({ type: 'error', text: data.message || 'Veuillez vérifier les informations saisies.' });
      }
    } catch {
      setRechargeFeedback({ type: 'error', text: 'Connexion momentanément indisponible. Réessayez.' });
    } finally {
      setIsSubmittingRecharge(false);
    }
  };

  // Launch Withdrawal Request (Minimum 5 000 FCFA, Admin validation required)
  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawFeedback(null);

    if (!withdrawOperator) {
      setWithdrawFeedback({
        type: 'error',
        text: withdrawCountryInfo.gatewayNote || 'Aucun réseau actif sélectionné pour la réception.',
      });
      return;
    }

    const amountNum = Math.floor(Number(withdrawAmount));
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
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          phone: `${withdrawCountryInfo.phonePrefix}${withdrawPhone.replace(/[^0-9]/g, '')}`,
          amount: amountNum,
          country: withdrawCountryInfo.code,
          network: withdrawOperator.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user) onPaymentSuccess(data.user);
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
                  Nom complet du payeur (Obligatoire)
                </label>
                <input
                  type="text"
                  required
                  value={rechargeCustomerName}
                  onChange={(e) => setRechargeCustomerName(e.target.value)}
                  placeholder="Ex: Kouamé Jean-Marc"
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
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  {COUNTRIES_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.currency}) — {c.operators.length > 0 ? c.operators.map((o) => o.name).join(', ') : 'Indisponible'}
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
                        onClick={() => setRechargeOperator(op)}
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
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  ID de votre compte {user.bookmaker} (inscrit à l'inscription)
                </label>
                <input
                  type="text"
                  required
                  value={depositBookmakerId}
                  onChange={(e) => setDepositBookmakerId(e.target.value)}
                  placeholder="Ex: 849201453"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                {user.bookmakerUserId && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    ID enregistré : <strong className="font-mono">{user.bookmakerUserId}</strong>
                  </span>
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
                    ? 'Envoi en cours...'
                    : `Demander Rechargement ${Number(rechargeAmount || 0).toLocaleString('fr-FR')} ${rechargeCountryInfo.currency}`}
                </span>
              </button>
            </form>
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

      {/* 60-Second Confirmation Screen while Waiting for Admin */}
      {isWaitingAdminApproval && currentTransaction ? (
        <div className="bg-white border-2 border-amber-300 rounded-2xl p-4 shadow-md space-y-4">
          <div className="flex items-center justify-between text-[11px] font-mono border-b border-slate-100 pb-2.5">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              CONFIRMATION EN COURS
            </span>
            <span className="text-slate-500">Réf: {currentTransaction.id}</span>
          </div>

          <div className="text-center space-y-3">
            <div className="w-24 h-24 mx-auto rounded-full border-4 border-amber-200 flex items-center justify-center bg-amber-50/40">
              <span
                className={`text-2xl font-mono font-black tabular-nums ${
                  countdown > 15 ? 'text-amber-700' : countdown > 0 ? 'text-rose-600' : 'text-slate-400'
                }`}
              >
                00:{countdown < 10 ? `0${countdown}` : countdown}
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-1000"
                style={{ width: `${(countdown / 60) * 100}%` }}
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs space-y-1.5">
              <div className="font-bold text-amber-950">Action requise (0 à 60 secondes) :</div>
              <p className="text-slate-700 leading-relaxed">
                Confirmez le prélèvement de <strong>{currentAmount} {vipCountryInfo.currency}</strong> sur votre téléphone (
                <strong>{currentTransaction.phone}</strong>) avec votre code secret Mobile Money, sinon l'opération expirera.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 space-y-1.5">
            <div className="font-bold">En attente d'approbation par l'administrateur</div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              Dès que l'administrateur confirme votre paiement, votre interface bascule automatiquement sur le tableau de bord Aviator & Code 15.
            </p>
          </div>

          <div className="space-y-2">
            {!hasUserConfirmedOnPhone ? (
              <button
                type="button"
                onClick={() => setHasUserConfirmedOnPhone(true)}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>J'ai composé mon code secret</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold text-center">
                Code composé · En attente de validation admin...
              </div>
            )}

            <div className="flex items-center gap-2">
              {countdown === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCountdown(60);
                    setHasUserConfirmedOnPhone(false);
                  }}
                  className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Relancer 60s</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsWaitingAdminApproval(false);
                  setCurrentTransaction(null);
                  setCountdown(60);
                }}
                className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>
            </div>
          </div>
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
                Accès direct au Jeu Aviator, Code 15 exact 10s avant chaque vol et retraits Mobile Money.
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
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                {COUNTRIES_LIST.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.currency}) — {c.operators.length > 0 ? c.operators.map((o) => o.name).join(', ') : 'Indisponible'}
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
                        onClick={() => setSelectedOperator(op)}
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

            {/* Mandatory Full Name (Aucun paiement anonyme) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Nom complet du client (Obligatoire)
              </label>
              <input
                type="text"
                required
                value={vipCustomerName}
                onChange={(e) => setVipCustomerName(e.target.value)}
                placeholder="Ex: Kouamé Jean-Marc"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                ID de votre compte {user.bookmaker} (inscrit à l'inscription)
              </label>
              <input
                type="text"
                required
                value={vipBookmakerId}
                onChange={(e) => setVipBookmakerId(e.target.value)}
                placeholder="Ex: 849201453"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Numéro Mobile Money {selectedOperator ? `(${selectedOperator.name})` : ''}
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
              <span>{isPaying ? 'Envoi...' : `Payer ${currentAmount} ${vipCountryInfo.currency} (${selectedVip})`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
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
