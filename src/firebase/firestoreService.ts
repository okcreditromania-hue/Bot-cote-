import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import type { AviatorRoundHistoryItem, ClientOperation, User } from '../types';
import type { TransactionRecord } from '../types/saspay';

export const ADMIN_EMAIL = 'okcreditromania@gmail.com';

export function sanitizeFirestoreId(raw: string | undefined, fallbackPrefix: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : val == null ? fallback : String(val).trim();
  return s.slice(0, maxLen);
}

function clampNum(val: unknown, min = 0, max = 100000000, fallback = 0): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function toIsoString(val: unknown, fallback?: string): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim()) return val;
  return fallback || new Date().toISOString();
}

export interface ServerSupportMessageDTO {
  id: string;
  sender: 'client' | 'admin';
  text: string;
  timestamp: string;
  read: boolean;
}

export interface ServerSupportConversationDTO {
  userId: string;
  firebaseUid?: string;
  userName: string;
  userPhone: string;
  userCountry: string;
  lastMessageAt: string;
  unreadCountClient: number;
  unreadCountAdmin: number;
  messages: ServerSupportMessageDTO[];
}

export interface FullAppSnapshot {
  users: User[];
  transactions: TransactionRecord[];
  operations: ClientOperation[];
  supportConversations: ServerSupportConversationDTO[];
  aviatorHistory: AviatorRoundHistoryItem[];
}

export async function ensureAdminDoc(firebaseUser: FirebaseAuthUser): Promise<void> {
  if (
    !firebaseUser ||
    firebaseUser.email !== ADMIN_EMAIL ||
    !firebaseUser.emailVerified
  ) {
    return;
  }
  const adminId = sanitizeFirestoreId(firebaseUser.uid, 'admin');
  const path = `admins/${adminId}`;
  const ref = doc(db, 'admins', adminId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: adminId,
        email: clampStr(firebaseUser.email, 160),
        role: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function buildUserDocPayload(
  user: User,
  overrideFirebaseUid?: string,
  isSelfClientWrite = false
): Record<string, unknown> {
  const id = sanitizeFirestoreId(user.id, 'usr');
  const firebaseUid = clampStr(
    overrideFirebaseUid !== undefined ? overrideFirebaseUid : user.firebaseUid || '',
    128
  ).replace(/[^a-zA-Z0-9_\-]/g, '');

  const payload: Record<string, unknown> = {
    id,
    firebaseUid,
    fullName: clampStr(user.fullName, 120, 'Client VIP') || 'Client VIP',
    phone: clampStr(user.phone, 30, '000000') || '000000',
    country: clampStr(user.country, 50, 'Bénin') || 'Bénin',
    bookmaker: clampStr(user.bookmaker, 50, '1xBet') || '1xBet',
    vipTier: user.vipTier === 'VIP2' ? 'VIP2' : 'VIP1',
    paymentStatus:
      isSelfClientWrite
        ? 'unpaid'
        : user.paymentStatus === 'paid' || user.paymentStatus === 'pending'
        ? user.paymentStatus
        : 'unpaid',
    balance: isSelfClientWrite ? 0 : clampNum(user.balance, 0, 100000000, 0),
  };

  if (user.email) payload.email = clampStr(user.email, 160);
  if (user.bookmakerUserId) payload.bookmakerUserId = clampStr(user.bookmakerUserId, 80);
  if (!isSelfClientWrite && typeof user.amountPaid === 'number' && user.amountPaid >= 0) {
    payload.amountPaid = clampNum(user.amountPaid, 0, 100000000, 0);
  }
  if (user.paymentReference) payload.paymentReference = clampStr(user.paymentReference, 128);
  if (user.paymentMethod) payload.paymentMethod = clampStr(user.paymentMethod, 50);
  if (user.paymentDate) payload.paymentDate = clampStr(user.paymentDate, 60);
  if (user.registeredAt) payload.registeredAt = clampStr(user.registeredAt, 60);
  if (user.notes) payload.notes = clampStr(user.notes, 500);

  return payload;
}

export async function upsertUserToFirestore(
  user: User,
  options: { isAdminActor?: boolean; overrideFirebaseUid?: string } = {}
): Promise<void> {
  const docId = sanitizeFirestoreId(user.id, 'usr');
  const path = `users/${docId}`;
  const ref = doc(db, 'users', docId);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      const prev = existingSnap.data();
      if (options.isAdminActor) {
        const mergedStatus =
          prev.paymentStatus === 'paid' && user.paymentStatus !== 'paid'
            ? prev.paymentStatus
            : user.paymentStatus || prev.paymentStatus || 'unpaid';
        const mergedBalance =
          typeof user.balance === 'number' ? user.balance : clampNum(prev.balance, 0);
        const fullPayload = buildUserDocPayload(
          {
            ...user,
            id: docId,
            paymentStatus: mergedStatus,
            balance: mergedBalance,
          },
          options.overrideFirebaseUid ?? (prev.firebaseUid || user.firebaseUid || ''),
          false
        );
        await updateDoc(ref, {
          ...fullPayload,
          createdAt: prev.createdAt,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Non-admin client self-update: strictly limited to allowed profile keys
        const updateData: Record<string, unknown> = {
          fullName: clampStr(user.fullName, 120, prev.fullName || 'Client VIP'),
          phone: clampStr(user.phone, 30, prev.phone || '000000'),
          country: clampStr(user.country, 50, prev.country || 'Bénin'),
          bookmaker: clampStr(user.bookmaker, 50, prev.bookmaker || '1xBet'),
          vipTier: user.vipTier === 'VIP2' ? 'VIP2' : 'VIP1',
          updatedAt: serverTimestamp(),
        };
        if (user.bookmakerUserId !== undefined) {
          updateData.bookmakerUserId = clampStr(user.bookmakerUserId, 80);
        }
        if (user.email) {
          updateData.email = clampStr(user.email, 160);
        }
        if (user.notes) {
          updateData.notes = clampStr(user.notes, 500);
        }
        await updateDoc(ref, updateData);
      }
    } else {
      const createPayload = buildUserDocPayload(
        { ...user, id: docId },
        options.overrideFirebaseUid,
        !options.isAdminActor
      );
      await setDoc(ref, {
        ...createPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertTransactionToFirestore(
  tx: TransactionRecord,
  options: { firebaseUid?: string; isAdminActor?: boolean } = {}
): Promise<void> {
  const txId = sanitizeFirestoreId(tx.id, 'tx');
  const userId = sanitizeFirestoreId(tx.userId || options.firebaseUid, 'usr');
  const firebaseUid = clampStr(options.firebaseUid ?? tx.firebaseUid ?? '', 128).replace(
    /[^a-zA-Z0-9_\-]/g,
    ''
  );
  const path = `transactions/${txId}`;
  const ref = doc(db, 'transactions', txId);

  const payload: Record<string, unknown> = {
    id: txId,
    userId,
    firebaseUid,
    amount: clampNum(tx.amount, 1, 100000000, 100),
    currency: clampStr(tx.currency, 10, 'XOF') || 'XOF',
    country: clampStr(tx.country, 10, 'BJ') || 'BJ',
    network: clampStr(tx.network, 50, 'mtn_bj') || 'mtn_bj',
    phone: clampStr(tx.phone, 30, '000000') || '000000',
    customerName: clampStr(tx.customerName, 120, 'Client VIP') || 'Client VIP',
    status:
      !options.isAdminActor
        ? 'PENDING'
        : tx.status === 'SUCCESS' || tx.status === 'FAILED'
        ? tx.status
        : 'PENDING',
  };

  if (tx.saspayPaymentId) payload.saspayPaymentId = clampStr(tx.saspayPaymentId, 128);
  if (tx.transactionType) payload.transactionType = tx.transactionType;
  if (tx.countryName) payload.countryName = clampStr(tx.countryName, 50);
  if (tx.operatorName) payload.operatorName = clampStr(tx.operatorName, 80);
  if (tx.bookmakerUserId) payload.bookmakerUserId = clampStr(tx.bookmakerUserId, 80);
  if (tx.statusMessage) payload.statusMessage = clampStr(tx.statusMessage, 500);
  if (tx.description) payload.description = clampStr(tx.description, 500);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      if (!options.isAdminActor) return;
      const prev = existingSnap.data();
      await updateDoc(ref, {
        ...payload,
        createdAt: prev.createdAt,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertOperationToFirestore(
  op: ClientOperation,
  options: { firebaseUid?: string; isAdminActor?: boolean } = {}
): Promise<void> {
  const opId = sanitizeFirestoreId(op.id, 'op');
  const userId = sanitizeFirestoreId(op.userId || options.firebaseUid, 'usr');
  const firebaseUid = clampStr(options.firebaseUid ?? op.firebaseUid ?? '', 128).replace(
    /[^a-zA-Z0-9_\-]/g,
    ''
  );
  const path = `operations/${opId}`;
  const ref = doc(db, 'operations', opId);

  const payload: Record<string, unknown> = {
    id: opId,
    userId,
    firebaseUid,
    userPhone: clampStr(op.userPhone, 30, ''),
    type: op.type,
    amount: clampNum(op.amount, 0, 100000000, 0),
    status:
      !options.isAdminActor && ['VIP_ACTIVATION', 'RECHARGE', 'WITHDRAWAL'].includes(op.type)
        ? 'PENDING'
        : op.status,
    title: clampStr(op.title, 140, 'Opération') || 'Opération',
    description: clampStr(op.description, 500, ''),
  };
  if (op.reference) payload.reference = clampStr(op.reference, 128);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      if (!options.isAdminActor) return;
      const prev = existingSnap.data();
      await updateDoc(ref, {
        ...payload,
        createdAt: prev.createdAt,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertSupportConversationToFirestore(
  conv: ServerSupportConversationDTO,
  options: { firebaseUid?: string; isAdminActor?: boolean } = {}
): Promise<void> {
  const convId = sanitizeFirestoreId(conv.userId, 'conv');
  const firebaseUid = clampStr(options.firebaseUid ?? conv.firebaseUid ?? '', 128).replace(
    /[^a-zA-Z0-9_\-]/g,
    ''
  );
  const convPath = `supportConversations/${convId}`;
  const convRef = doc(db, 'supportConversations', convId);

  try {
    const existingSnap = await getDoc(convRef);
    const convPayload: Record<string, unknown> = {
      userId: convId,
      firebaseUid,
      userName: clampStr(conv.userName, 120, 'Client VIP') || 'Client VIP',
      userPhone: clampStr(conv.userPhone, 30, ''),
      userCountry: clampStr(conv.userCountry, 50, 'Bénin'),
      lastMessageAt: clampStr(conv.lastMessageAt, 60, new Date().toISOString()),
      unreadCountClient: clampNum(conv.unreadCountClient, 0, 10000, 0),
      unreadCountAdmin: clampNum(conv.unreadCountAdmin, 0, 10000, 0),
    };

    if (existingSnap.exists()) {
      const prev = existingSnap.data();
      if (options.isAdminActor) {
        await updateDoc(convRef, {
          ...convPayload,
          createdAt: prev.createdAt,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(convRef, {
          lastMessageAt: convPayload.lastMessageAt,
          unreadCountClient: convPayload.unreadCountClient,
          unreadCountAdmin: convPayload.unreadCountAdmin,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      await setDoc(convRef, {
        ...convPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Write messages subcollection (only missing messages so we don't rewrite history needlessly)
    for (const msg of conv.messages || []) {
      const msgId = sanitizeFirestoreId(msg.id, 'msg');
      const msgRef = doc(db, 'supportConversations', convId, 'messages', msgId);
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) {
        await setDoc(msgRef, {
          id: msgId,
          conversationId: convId,
          firebaseUid,
          sender: msg.sender === 'admin' ? 'admin' : 'client',
          text: clampStr(msg.text, 2000, '...'),
          timestamp: clampStr(msg.timestamp, 60, new Date().toISOString()),
          read: Boolean(msg.read),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, convPath);
  }
}

export async function upsertAviatorRoundToFirestore(
  round: AviatorRoundHistoryItem
): Promise<void> {
  const roundId = sanitizeFirestoreId(`round_${round.roundNumber}`, 'round');
  const path = `aviatorHistory/${roundId}`;
  const ref = doc(db, 'aviatorHistory', roundId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    await setDoc(ref, {
      id: roundId,
      roundNumber: clampNum(round.roundNumber, 1, 100000000, 1),
      crashPoint: clampNum(round.crashPoint, 1, 10000, 1.5),
      code15: clampStr(round.code15, 32, 'AV1500000000000'),
      timestamp: clampStr(round.timestamp, 60, new Date().toISOString()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function docToUser(data: Record<string, unknown>, docId: string): User {
  return {
    id: clampStr(data.id, 128, docId) || docId,
    firebaseUid: data.firebaseUid ? clampStr(data.firebaseUid, 128) : undefined,
    email: data.email ? clampStr(data.email, 160) : undefined,
    fullName: clampStr(data.fullName, 120, 'Client VIP'),
    phone: clampStr(data.phone, 30, ''),
    country: clampStr(data.country, 50, 'Bénin'),
    bookmaker: clampStr(data.bookmaker, 50, '1xBet'),
    bookmakerUserId: data.bookmakerUserId ? clampStr(data.bookmakerUserId, 80) : undefined,
    vipTier: data.vipTier === 'VIP2' ? 'VIP2' : 'VIP1',
    paymentStatus:
      data.paymentStatus === 'paid' || data.paymentStatus === 'pending'
        ? data.paymentStatus
        : 'unpaid',
    balance: clampNum(data.balance, 0, 100000000, 0),
    amountPaid: typeof data.amountPaid === 'number' ? data.amountPaid : undefined,
    paymentReference: data.paymentReference ? clampStr(data.paymentReference, 128) : undefined,
    paymentMethod: data.paymentMethod as User['paymentMethod'],
    paymentDate: data.paymentDate ? clampStr(data.paymentDate, 60) : undefined,
    registeredAt: data.registeredAt
      ? clampStr(data.registeredAt, 60)
      : toIsoString(data.createdAt),
    notes: data.notes ? clampStr(data.notes, 500) : undefined,
  };
}

function docToTransaction(data: Record<string, unknown>, docId: string): TransactionRecord {
  const network = clampStr(data.network, 50, 'mtn_bj') as TransactionRecord['network'];
  return {
    id: clampStr(data.id, 128, docId) || docId,
    userId: data.userId ? clampStr(data.userId, 128) : undefined,
    firebaseUid: data.firebaseUid ? clampStr(data.firebaseUid, 128) : undefined,
    saspayPaymentId: data.saspayPaymentId ? clampStr(data.saspayPaymentId, 128) : undefined,
    transactionType: data.transactionType as TransactionRecord['transactionType'],
    amount: clampNum(data.amount, 0, 100000000, 0),
    currency: 'XOF',
    country: clampStr(data.country, 10, 'BJ') as TransactionRecord['country'],
    countryName: clampStr(data.countryName, 50, 'Bénin'),
    network,
    operatorName: clampStr(data.operatorName, 80, network),
    operatorBrand: 'MTN',
    phone: clampStr(data.phone, 30, ''),
    customerName: clampStr(data.customerName, 120, 'Client VIP'),
    customerEmail: '',
    bookmakerUserId: data.bookmakerUserId ? clampStr(data.bookmakerUserId, 80) : undefined,
    description: clampStr(data.description, 500, ''),
    status:
      data.status === 'SUCCESS' || data.status === 'FAILED' ? data.status : 'PENDING',
    statusMessage: clampStr(data.statusMessage, 500, ''),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    idempotencyKey: docId,
  };
}

function docToOperation(data: Record<string, unknown>, docId: string): ClientOperation {
  return {
    id: clampStr(data.id, 128, docId) || docId,
    userId: clampStr(data.userId, 128, ''),
    firebaseUid: data.firebaseUid ? clampStr(data.firebaseUid, 128) : undefined,
    userPhone: clampStr(data.userPhone, 30, ''),
    type: (data.type as ClientOperation['type']) || 'VIP_ACTIVATION',
    amount: clampNum(data.amount, 0, 100000000, 0),
    status: (data.status as ClientOperation['status']) || 'PENDING',
    title: clampStr(data.title, 140, 'Opération'),
    description: clampStr(data.description, 500, ''),
    reference: data.reference ? clampStr(data.reference, 128) : undefined,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export async function pullFullSnapshotFromFirestore(): Promise<FullAppSnapshot> {
  const users: User[] = [];
  const transactions: TransactionRecord[] = [];
  const operations: ClientOperation[] = [];
  const supportConversations: ServerSupportConversationDTO[] = [];
  const aviatorHistory: AviatorRoundHistoryItem[] = [];

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach((d) => users.push(docToUser(d.data(), d.id)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }

  try {
    const txSnap = await getDocs(collection(db, 'transactions'));
    txSnap.forEach((d) => transactions.push(docToTransaction(d.data(), d.id)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'transactions');
  }

  try {
    const opSnap = await getDocs(collection(db, 'operations'));
    opSnap.forEach((d) => operations.push(docToOperation(d.data(), d.id)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'operations');
  }

  try {
    const convSnap = await getDocs(collection(db, 'supportConversations'));
    for (const cDoc of convSnap.docs) {
      const cData = cDoc.data();
      const messages: ServerSupportMessageDTO[] = [];
      try {
        const msgSnap = await getDocs(
          collection(db, 'supportConversations', cDoc.id, 'messages')
        );
        msgSnap.forEach((mDoc) => {
          const m = mDoc.data();
          messages.push({
            id: clampStr(m.id, 128, mDoc.id),
            sender: m.sender === 'admin' ? 'admin' : 'client',
            text: clampStr(m.text, 2000, ''),
            timestamp: clampStr(m.timestamp, 60, toIsoString(m.createdAt)),
            read: Boolean(m.read),
          });
        });
        messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      } catch {
        // fallback empty messages if subcollection inaccessible
      }
      supportConversations.push({
        userId: clampStr(cData.userId, 128, cDoc.id),
        firebaseUid: cData.firebaseUid ? clampStr(cData.firebaseUid, 128) : undefined,
        userName: clampStr(cData.userName, 120, 'Client VIP'),
        userPhone: clampStr(cData.userPhone, 30, ''),
        userCountry: clampStr(cData.userCountry, 50, 'Bénin'),
        lastMessageAt: clampStr(cData.lastMessageAt, 60, toIsoString(cData.updatedAt)),
        unreadCountClient: clampNum(cData.unreadCountClient, 0, 10000, 0),
        unreadCountAdmin: clampNum(cData.unreadCountAdmin, 0, 10000, 0),
        messages,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'supportConversations');
  }

  try {
    const avSnap = await getDocs(
      query(collection(db, 'aviatorHistory'), orderBy('roundNumber', 'desc'), limit(40))
    );
    avSnap.forEach((d) => {
      const r = d.data();
      aviatorHistory.push({
        roundNumber: clampNum(r.roundNumber, 1, 100000000, 1),
        crashPoint: clampNum(r.crashPoint, 1, 10000, 1.5),
        code15: clampStr(r.code15, 32, ''),
        timestamp: clampStr(r.timestamp, 60, toIsoString(r.createdAt)),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'aviatorHistory');
  }

  return { users, transactions, operations, supportConversations, aviatorHistory };
}

export async function pushFullSnapshotToFirestore(snapshot: FullAppSnapshot): Promise<void> {
  for (const u of snapshot.users || []) {
    await upsertUserToFirestore(u, { isAdminActor: true });
  }
  for (const tx of snapshot.transactions || []) {
    const matchedUser = snapshot.users.find((u) => u.id === tx.userId || u.phone === tx.phone);
    await upsertTransactionToFirestore(tx, {
      firebaseUid: tx.firebaseUid || matchedUser?.firebaseUid || '',
      isAdminActor: true,
    });
  }
  for (const op of snapshot.operations || []) {
    const matchedUser = snapshot.users.find((u) => u.id === op.userId || u.phone === op.userPhone);
    await upsertOperationToFirestore(op, {
      firebaseUid: op.firebaseUid || matchedUser?.firebaseUid || '',
      isAdminActor: true,
    });
  }
  for (const conv of snapshot.supportConversations || []) {
    const matchedUser = snapshot.users.find(
      (u) => u.id === conv.userId || u.phone === conv.userPhone
    );
    await upsertSupportConversationToFirestore(conv, {
      firebaseUid: conv.firebaseUid || matchedUser?.firebaseUid || '',
      isAdminActor: true,
    });
  }
  for (const round of (snapshot.aviatorHistory || []).slice(0, 25)) {
    await upsertAviatorRoundToFirestore(round);
  }
}

export async function pullClientSnapshotFromFirestore(firebaseUid: string): Promise<{
  user: User | null;
  transactions: TransactionRecord[];
  operations: ClientOperation[];
}> {
  let user: User | null = null;
  const transactions: TransactionRecord[] = [];
  const operations: ClientOperation[] = [];

  try {
    const qUsers = query(collection(db, 'users'), where('firebaseUid', '==', firebaseUid));
    const snap = await getDocs(qUsers);
    if (!snap.empty) {
      // Prefer paid user if multiple docs exist for same UID
      const list = snap.docs.map((d) => docToUser(d.data(), d.id));
      user = list.find((u) => u.paymentStatus === 'paid') || list[0];
    } else {
      const directSnap = await getDoc(doc(db, 'users', firebaseUid));
      if (directSnap.exists()) {
        user = docToUser(directSnap.data(), directSnap.id);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }

  try {
    const qTx = query(collection(db, 'transactions'), where('firebaseUid', '==', firebaseUid));
    const txSnap = await getDocs(qTx);
    txSnap.forEach((d) => transactions.push(docToTransaction(d.data(), d.id)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'transactions');
  }

  try {
    const qOp = query(collection(db, 'operations'), where('firebaseUid', '==', firebaseUid));
    const opSnap = await getDocs(qOp);
    opSnap.forEach((d) => operations.push(docToOperation(d.data(), d.id)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'operations');
  }

  return { user, transactions, operations };
}

export function subscribeClientFirestore(
  firebaseUid: string,
  callbacks: {
    onUserChange: (user: User) => void;
    onTransactionsChange: (txs: TransactionRecord[]) => void;
    onOperationsChange: (ops: ClientOperation[]) => void;
  }
): Unsubscribe {
  const unsubUsers = onSnapshot(
    query(collection(db, 'users'), where('firebaseUid', '==', firebaseUid)),
    (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => docToUser(d.data(), d.id));
        const best = list.find((u) => u.paymentStatus === 'paid') || list[0];
        callbacks.onUserChange(best);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  );

  const unsubTx = onSnapshot(
    query(collection(db, 'transactions'), where('firebaseUid', '==', firebaseUid)),
    (snap) => {
      const list = snap.docs.map((d) => docToTransaction(d.data(), d.id));
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      callbacks.onTransactionsChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    }
  );

  const unsubOps = onSnapshot(
    query(collection(db, 'operations'), where('firebaseUid', '==', firebaseUid)),
    (snap) => {
      const list = snap.docs.map((d) => docToOperation(d.data(), d.id));
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      callbacks.onOperationsChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'operations');
    }
  );

  return () => {
    unsubUsers();
    unsubTx();
    unsubOps();
  };
}

export function subscribeAdminFirestore(onUpdate: () => void): Unsubscribe {
  const unsubUsers = onSnapshot(
    collection(db, 'users'),
    () => onUpdate(),
    (error) => handleFirestoreError(error, OperationType.LIST, 'users')
  );
  const unsubTx = onSnapshot(
    collection(db, 'transactions'),
    () => onUpdate(),
    (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')
  );
  const unsubOps = onSnapshot(
    collection(db, 'operations'),
    () => onUpdate(),
    (error) => handleFirestoreError(error, OperationType.LIST, 'operations')
  );
  return () => {
    unsubUsers();
    unsubTx();
    unsubOps();
  };
}
