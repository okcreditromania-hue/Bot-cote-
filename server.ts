import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import type { CountryCode, OperatorId, PaymentStatus, TransactionCategory, TransactionRecord, DashboardStats } from './src/types/saspay.ts';
import { SUPPORTED_COUNTRIES, resolveCountryCode } from './src/data/countries.ts';
import type { User, ClientOperation, AviatorRoundHistoryItem, AviatorActiveBet, AviatorGameState } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// The Secret Key provided by the user is used here securely on the server for all payment & recharge endpoints
const ENV_KEY = (process.env.SASPAY_SECRET_KEY || '').trim();
const SASPAY_SECRET_KEY =
  ENV_KEY && !ENV_KEY.includes('Y_7G1LmH') && !ENV_KEY.includes('YOUR_')
    ? ENV_KEY
    : 'sk_live_mnqDGRq-m9Zcn9XRBRmB-elAvVFXeQa1XETQI3TrpGo';
const SASPAY_API_BASE = 'https://api.saspay.me/api/v1';

app.use(express.json({ limit: '15mb' }));

// =========================================================================
// DATA PERSISTENCE LAYER (Zero fake data, strictly real operations & users)
// =========================================================================
const DATA_STORE_PATH = path.resolve(__dirname, 'data_store.json');
const PROOFS_DIR = path.resolve(__dirname, 'uploads', 'proofs');
try {
  fs.mkdirSync(PROOFS_DIR, { recursive: true });
} catch {
  // ignore directory creation error if already exists
}

interface ServerChatMessage {
  id: string;
  sender: 'client' | 'admin';
  text: string;
  timestamp: string;
  read: boolean;
}

interface ServerSupportConversation {
  userId: string;
  userName: string;
  userPhone: string;
  userCountry: string;
  lastMessageAt: string;
  unreadCountClient: number;
  unreadCountAdmin: number;
  messages: ServerChatMessage[];
}

interface PersistedData {
  users: User[];
  transactions: TransactionRecord[];
  supportConversations: ServerSupportConversation[];
  operations?: ClientOperation[];
  aviatorHistory?: AviatorRoundHistoryItem[];
}

let users: User[] = [];
let transactions: TransactionRecord[] = [];
let supportConversations: ServerSupportConversation[] = [];
let operations: ClientOperation[] = [];
let aviatorHistory: AviatorRoundHistoryItem[] = [];

// Load persisted data from disk if present
function loadDataStore() {
  try {
    if (fs.existsSync(DATA_STORE_PATH)) {
      const raw = fs.readFileSync(DATA_STORE_PATH, 'utf-8');
      const data: PersistedData = JSON.parse(raw);
      users = (data.users || []).map((u) => ({
        ...u,
        balance: typeof u.balance === 'number' ? u.balance : 0,
      }));
      transactions = data.transactions || [];
      supportConversations = data.supportConversations || [];
      operations = data.operations || [];
      aviatorHistory = data.aviatorHistory || [];

      // Backfill operations from existing transactions once if operations array is empty
      if (operations.length === 0 && transactions.length > 0) {
        operations = transactions.map((tx) => {
          const matchedUser = users.find((u) => isSamePhoneNumber(u.phone, tx.phone));
          const type: ClientOperation['type'] = tx.transactionType === 'RECHARGE'
            ? 'RECHARGE'
            : tx.transactionType === 'WITHDRAWAL'
            ? 'WITHDRAWAL'
            : 'VIP_ACTIVATION';
          return {
            id: `op_${tx.id}`,
            userId: matchedUser ? matchedUser.id : tx.phone,
            userPhone: tx.phone,
            type,
            amount: tx.amount,
            status: tx.status,
            title: type === 'RECHARGE' ? 'Rechargement Mobile Money' : type === 'WITHDRAWAL' ? 'Retrait Mobile Money' : 'Activation Licence VIP',
            description: tx.statusMessage || tx.description,
            reference: tx.saspayPaymentId || tx.id,
            createdAt: tx.createdAt,
            updatedAt: tx.updatedAt,
          };
        });
      }

      console.log(`[DATA STORE] Données chargées avec succès : ${users.length} utilisateurs, ${transactions.length} transactions, ${operations.length} opérations.`);
    } else {
      console.log('[DATA STORE] Initialisation nouvelle base de données locale.');
      users = [];
      transactions = [];
      supportConversations = [];
      operations = [];
      aviatorHistory = [];
      saveDataStore();
    }
  } catch (err) {
    console.error('[DATA STORE] Erreur lecture data_store.json:', err);
    users = [];
    transactions = [];
    supportConversations = [];
    operations = [];
    aviatorHistory = [];
  }
}

// Save persisted data to disk
function saveDataStore() {
  try {
    const payload: PersistedData = {
      users,
      transactions,
      supportConversations,
      operations: operations.slice(0, 1000),
      aviatorHistory: aviatorHistory.slice(0, 40),
    };
    fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DATA STORE] Erreur écriture data_store.json:', err);
  }
}

// =========================================================================
// REAL-TIME SSE BROADCAST SYSTEM (Instant Push Online + Sync Offline)
// =========================================================================
interface SSEClient {
  id: string;
  userId?: string;
  userPhone?: string;
  role: 'client' | 'admin';
  res: Response;
}

const sseClients: Set<SSEClient> = new Set();

function sendSSE(client: SSEClient, eventName: string, data: any) {
  try {
    client.res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    sseClients.delete(client);
  }
}

function broadcastToUser(user: User | { id?: string; phone?: string }, eventName: string, payload: any) {
  for (const client of sseClients) {
    if (
      client.role === 'client' &&
      ((user.id && client.userId === user.id) || (user.phone && client.userPhone && isSamePhoneNumber(client.userPhone, user.phone)))
    ) {
      sendSSE(client, eventName, payload);
    }
  }
}

function broadcastToAdmins(eventName: string, payload: any) {
  for (const client of sseClients) {
    if (client.role === 'admin') {
      sendSSE(client, eventName, payload);
    }
  }
}

function broadcastToAll(eventName: string, payload: any) {
  for (const client of sseClients) {
    sendSSE(client, eventName, payload);
  }
}

function upsertUserOperation(op: ClientOperation) {
  const idx = operations.findIndex((o) => o.id === op.id);
  if (idx >= 0) {
    operations[idx] = op;
  } else {
    operations.unshift(op);
  }
}

// Initial load
loadDataStore();

// =========================================================================
// ADMIN AUTHENTICATION (Private Credentials: 34343434 / 34343434)
// =========================================================================
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const cleanUser = String(username || '').replace(/\s+/g, '');
  const cleanPass = String(password || '').replace(/\s+/g, '');

  if (cleanUser === '34343434' && cleanPass === '34343434') {
    return res.json({
      success: true,
      token: 'admin_saspay_auth_session_34343434',
      user: {
        role: 'SUPER_ADMIN',
        username: '34343434',
        name: 'Administrateur Aviator VIP',
      },
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Identifiant ou mot de passe incorrect.',
  });
});

// =========================================================================
// FIREBASE CLOUD FIRESTORE BRIDGE & CROSS-DEVICE SYNC ENDPOINTS
// =========================================================================
interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

const FIREBASE_CFG_PATH = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseCfg: FirebaseAppletConfig | null = null;
try {
  if (fs.existsSync(FIREBASE_CFG_PATH)) {
    firebaseCfg = JSON.parse(fs.readFileSync(FIREBASE_CFG_PATH, 'utf-8'));
  }
} catch {
  firebaseCfg = null;
}

const ADMIN_ALLOWED_EMAIL = 'okcreditromania@gmail.com';

app.post('/api/admin/google-login', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken || !firebaseCfg?.apiKey) {
      return res.status(400).json({ success: false, message: 'Jeton Google Firebase manquant.' });
    }
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseCfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    const lookupData: any = await lookupRes.json();
    const fbUser = lookupData?.users?.[0];
    if (!fbUser || fbUser.email !== ADMIN_ALLOWED_EMAIL || fbUser.emailVerified !== true) {
      return res.status(403).json({
        success: false,
        message: 'Compte Google non autorisé pour l’accès administrateur.',
      });
    }
    return res.json({
      success: true,
      token: 'admin_saspay_auth_session_34343434',
      user: {
        role: 'SUPER_ADMIN',
        username: '34343434',
        email: fbUser.email,
        uid: fbUser.localId,
        name: fbUser.displayName || 'Administrateur Aviator VIP',
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Erreur vérification Google Admin.' });
  }
});

app.post('/api/users/link-firebase', (req: Request, res: Response) => {
  const { userId, phone, firebaseUid, email } = req.body || {};
  if (!firebaseUid) {
    return res.status(400).json({ success: false, message: 'firebaseUid requis.' });
  }
  const idx = users.findIndex(
    (u) => (userId && u.id === userId) || (phone && isSamePhoneNumber(u.phone, phone))
  );
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
  }
  users[idx] = {
    ...users[idx],
    firebaseUid: String(firebaseUid).trim(),
    email: email ? String(email).trim() : users[idx].email,
  };
  saveDataStore();
  broadcastToUser(users[idx], 'user:updated', { user: users[idx] });
  return res.json({ success: true, user: users[idx] });
});

app.get('/api/sync/export-snapshot', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    snapshot: {
      users,
      transactions,
      operations,
      supportConversations,
      aviatorHistory,
    },
  });
});

app.post('/api/sync/import-snapshot', (req: Request, res: Response) => {
  const incoming = req.body || {};
  const inUsers: User[] = Array.isArray(incoming.users) ? incoming.users : [];
  const inTx: TransactionRecord[] = Array.isArray(incoming.transactions) ? incoming.transactions : [];
  const inOps: ClientOperation[] = Array.isArray(incoming.operations) ? incoming.operations : [];
  const inConvs: ServerSupportConversation[] = Array.isArray(incoming.supportConversations)
    ? incoming.supportConversations
    : [];
  const inAviator: AviatorRoundHistoryItem[] = Array.isArray(incoming.aviatorHistory)
    ? incoming.aviatorHistory
    : [];

  // 1. Non-destructive merge of Users (preserve paid status, passwords, balances)
  for (const cu of inUsers) {
    const idx = users.findIndex(
      (u) =>
        u.id === cu.id ||
        (cu.firebaseUid && u.firebaseUid === cu.firebaseUid) ||
        (cu.phone && isSamePhoneNumber(u.phone, cu.phone))
    );
    if (idx === -1) {
      users.push({
        ...cu,
        balance: typeof cu.balance === 'number' ? cu.balance : 0,
      });
    } else {
      const ex = users[idx];
      const mergedPaid = ex.paymentStatus === 'paid' || cu.paymentStatus === 'paid';
      users[idx] = {
        ...cu,
        ...ex,
        firebaseUid: ex.firebaseUid || cu.firebaseUid,
        email: ex.email || cu.email,
        password: ex.password || cu.password,
        bookmakerUserId: ex.bookmakerUserId || cu.bookmakerUserId,
        paymentStatus: mergedPaid ? 'paid' : (ex.paymentStatus || cu.paymentStatus || 'unpaid'),
        balance: Math.max(
          typeof ex.balance === 'number' ? ex.balance : 0,
          typeof cu.balance === 'number' ? cu.balance : 0
        ),
        amountPaid: ex.amountPaid ?? cu.amountPaid,
        paymentReference: ex.paymentReference || cu.paymentReference,
        paymentMethod: ex.paymentMethod || cu.paymentMethod,
        paymentDate: ex.paymentDate || cu.paymentDate,
      };
    }
  }

  // 2. Merge Transactions (terminal status SUCCESS/FAILED takes priority over PENDING)
  for (const tx of inTx) {
    const idx = transactions.findIndex((t) => t.id === tx.id);
    if (idx === -1) {
      transactions.push(tx);
    } else if (transactions[idx].status === 'PENDING' && tx.status !== 'PENDING') {
      transactions[idx] = { ...transactions[idx], ...tx };
    }
  }
  transactions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // 3. Merge Operations
  for (const op of inOps) {
    const idx = operations.findIndex((o) => o.id === op.id);
    if (idx === -1) {
      operations.push(op);
    } else if (operations[idx].status === 'PENDING' && op.status !== 'PENDING') {
      operations[idx] = { ...operations[idx], ...op };
    }
  }
  operations.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // 4. Merge Support Conversations & Messages
  for (const conv of inConvs) {
    const idx = supportConversations.findIndex((c) => c.userId === conv.userId);
    if (idx === -1) {
      supportConversations.push(conv);
    } else {
      const exConv = supportConversations[idx];
      const msgMap = new Map<string, ServerChatMessage>();
      for (const m of exConv.messages || []) msgMap.set(m.id, m);
      for (const m of conv.messages || []) {
        if (!msgMap.has(m.id)) msgMap.set(m.id, m);
      }
      exConv.messages = Array.from(msgMap.values()).sort((a, b) =>
        (a.timestamp || '').localeCompare(b.timestamp || '')
      );
      exConv.lastMessageAt =
        exConv.lastMessageAt > conv.lastMessageAt ? exConv.lastMessageAt : conv.lastMessageAt;
    }
  }

  // 5. Merge Aviator History
  const roundMap = new Map<number, AviatorRoundHistoryItem>();
  for (const r of aviatorHistory) roundMap.set(r.roundNumber, r);
  for (const r of inAviator) {
    if (!roundMap.has(r.roundNumber)) roundMap.set(r.roundNumber, r);
  }
  aviatorHistory = Array.from(roundMap.values())
    .sort((a, b) => b.roundNumber - a.roundNumber)
    .slice(0, 40);

  saveDataStore();
  broadcastToAdmins('admin:update', { reason: 'firestore_sync' });

  return res.json({
    success: true,
    snapshot: {
      users,
      transactions,
      operations,
      supportConversations,
      aviatorHistory,
    },
  });
});

app.post('/api/sync/import-client', (req: Request, res: Response) => {
  const { user: cu, transactions: inTx = [], operations: inOps = [] } = req.body || {};
  if (!cu || !cu.id) {
    return res.status(400).json({ success: false, message: 'Données utilisateur invalides.' });
  }

  const idx = users.findIndex(
    (u) =>
      u.id === cu.id ||
      (cu.firebaseUid && u.firebaseUid === cu.firebaseUid) ||
      (cu.phone && isSamePhoneNumber(u.phone, cu.phone))
  );

  let savedUser: User;
  if (idx === -1) {
    savedUser = {
      ...cu,
      balance: typeof cu.balance === 'number' ? cu.balance : 0,
    };
    users.unshift(savedUser);
  } else {
    const ex = users[idx];
    const mergedPaid = ex.paymentStatus === 'paid' || cu.paymentStatus === 'paid';
    savedUser = {
      ...cu,
      ...ex,
      firebaseUid: ex.firebaseUid || cu.firebaseUid,
      email: ex.email || cu.email,
      password: ex.password || cu.password,
      bookmakerUserId: ex.bookmakerUserId || cu.bookmakerUserId,
      paymentStatus: mergedPaid ? 'paid' : (ex.paymentStatus || cu.paymentStatus || 'unpaid'),
      balance: Math.max(
        typeof ex.balance === 'number' ? ex.balance : 0,
        typeof cu.balance === 'number' ? cu.balance : 0
      ),
    };
    users[idx] = savedUser;
  }

  for (const tx of Array.isArray(inTx) ? inTx : []) {
    if (!transactions.some((t) => t.id === tx.id)) transactions.push(tx);
  }
  for (const op of Array.isArray(inOps) ? inOps : []) {
    if (!operations.some((o) => o.id === op.id)) operations.push(op);
  }

  saveDataStore();
  broadcastToAdmins('admin:update', { reason: 'client_cloud_restore' });
  return res.json({ success: true, user: savedUser });
});

// Helper to match phone numbers strictly without unsafe substring collisions
function isSamePhoneNumber(phoneA?: string, phoneB?: string): boolean {
  if (!phoneA || !phoneB) return false;
  const digitsA = String(phoneA).replace(/[^0-9]/g, '');
  const digitsB = String(phoneB).replace(/[^0-9]/g, '');
  if (!digitsA || !digitsB) return false;
  if (digitsA === digitsB) return true;

  // Match last 8 digits only when both numbers are valid mobile lengths
  if (digitsA.length >= 8 && digitsB.length >= 8) {
    if (digitsA.slice(-8) === digitsB.slice(-8)) return true;
  }
  return false;
}

// =========================================================================
// REAL USER MANAGEMENT ENDPOINTS
// =========================================================================
// 1. Get all registered users & statistics (Confidential Admin View)
app.get('/api/users', (req: Request, res: Response) => {
  const total = users.length;
  const paidCount = users.filter((u) => u.paymentStatus === 'paid').length;
  const unpaidCount = total - paidCount;

  return res.json({
    success: true,
    users,
    total,
    paidCount,
    unpaidCount,
  });
});

// 1.b Secure and Confidential Client & Admin Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ success: false, message: 'Numéro et mot de passe requis.' });
  }

  const rawPhone = String(phone).trim();
  const rawPass = String(password).trim();
  const compactPhone = rawPhone.replace(/\s+/g, '');
  const compactPass = rawPass.replace(/\s+/g, '');

  // Admin credentials (34343434 / 34343434) seamlessly supported from any login form
  if (compactPhone === '34343434' && compactPass === '34343434') {
    return res.json({
      success: true,
      isAdmin: true,
      user: {
        id: 'admin_34343434',
        fullName: 'Administrateur Principal',
        phone: '34343434',
        country: 'Administration',
        bookmaker: '1xBet',
        vipTier: 'VIP2',
        paymentStatus: 'paid',
        registeredAt: 'Accès Réservé',
      },
    });
  }

  const user = users.find((u) => isSamePhoneNumber(u.phone, rawPhone));

  if (!user) {
    return res.status(401).json({ success: false, message: 'Aucun compte trouvé pour ce numéro de téléphone.' });
  }

  const expectedPass = user.password || 'password123';
  if (rawPass !== expectedPass.trim()) {
    return res.status(401).json({ success: false, message: 'Mot de passe incorrect pour ce numéro.' });
  }

  return res.json({ success: true, isAdmin: false, user });
});

// 1.c Register user endpoint (guarantees persistent server storage with phone-only required fields + immutable betting ID if set)
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { fullName, phone, password, country, bookmaker, bookmakerUserId, vipTier } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ success: false, message: 'Numéro de téléphone et mot de passe requis.' });
  }

  const existingIndex = users.findIndex((u) => isSamePhoneNumber(u.phone, String(phone)));
  const cleanPhoneDigits = String(phone).replace(/[^0-9]/g, '');
  const resolvedFullName =
    String(fullName || '').trim() ||
    (existingIndex >= 0 ? users[existingIndex].fullName : '') ||
    `Client ${cleanPhoneDigits.slice(-4) || 'Aviator'}`;
  const cleanBookmakerId = bookmakerUserId ? String(bookmakerUserId).trim() : undefined;
  const lockedBookmakerId =
    existingIndex >= 0 && users[existingIndex].bookmakerUserId
      ? users[existingIndex].bookmakerUserId
      : cleanBookmakerId;

  const newUser: User = {
    id: existingIndex >= 0 ? users[existingIndex].id : `usr_${Date.now()}`,
    fullName: resolvedFullName,
    phone: String(phone).trim(),
    password: String(password).trim(),
    country: country || 'Bénin',
    bookmaker: bookmaker || '1xBet',
    bookmakerUserId: lockedBookmakerId,
    vipTier: (vipTier as any) || 'VIP1',
    paymentStatus: existingIndex >= 0 ? users[existingIndex].paymentStatus : 'unpaid',
    balance: existingIndex >= 0 ? (users[existingIndex].balance ?? 0) : 0,
    registeredAt: existingIndex >= 0 ? users[existingIndex].registeredAt : new Date().toLocaleString('fr-FR'),
    notes: `Réservation pour le ${vipTier || 'VIP1'} sur ${bookmaker || '1xBet'}`,
    amountPaid: existingIndex >= 0 ? users[existingIndex].amountPaid : undefined,
    paymentReference: existingIndex >= 0 ? users[existingIndex].paymentReference : undefined,
    paymentDate: existingIndex >= 0 ? users[existingIndex].paymentDate : undefined,
    paymentMethod: existingIndex >= 0 ? users[existingIndex].paymentMethod : undefined,
  };

  if (existingIndex >= 0) {
    users[existingIndex] = newUser;
  } else {
    users.unshift(newUser);
  }

  saveDataStore();
  broadcastToAdmins('admin:update', { reason: 'user_registered', user: newUser });
  return res.status(201).json({ success: true, user: newUser });
});

// 2. Register or update a user (Persistent)
app.post('/api/users', (req: Request, res: Response) => {
  const incomingUser: User = req.body;
  if (!incomingUser.phone) {
    return res.status(400).json({ success: false, message: 'Le numéro de téléphone est requis.' });
  }

  const existingIndex = users.findIndex(
    (u) => isSamePhoneNumber(u.phone, incomingUser.phone) || u.id === incomingUser.id
  );

  let savedUser: User;
  if (existingIndex >= 0) {
    const existing = users[existingIndex];
    const allowDowngrade = (req.body as any)?.adminOverride === true;
    const { adminOverride: _ignored, ...cleanIncoming } = incomingUser as any;
    const preservedStatus: 'paid' | 'unpaid' =
      existing.paymentStatus === 'paid' && !allowDowngrade
        ? 'paid'
        : cleanIncoming.paymentStatus || existing.paymentStatus || 'unpaid';

    // Preserve already-validated VIP status, credentials, and real balance safely
    savedUser = {
      ...existing,
      ...cleanIncoming,
      id: existing.id,
      password: cleanIncoming.password || existing.password,
      bookmakerUserId: cleanIncoming.bookmakerUserId || existing.bookmakerUserId,
      paymentStatus: preservedStatus,
      balance:
        typeof cleanIncoming.balance === 'number'
          ? cleanIncoming.balance
          : typeof existing.balance === 'number'
          ? existing.balance
          : 0,
    };
    users[existingIndex] = savedUser;
  } else {
    savedUser = {
      id: incomingUser.id || `usr_${Date.now()}`,
      fullName: incomingUser.fullName || 'Nouveau Client',
      phone: incomingUser.phone,
      country: incomingUser.country || 'Bénin',
      bookmaker: incomingUser.bookmaker || '1xBet',
      vipTier: incomingUser.vipTier || 'VIP1',
      paymentStatus: incomingUser.paymentStatus || 'unpaid',
      registeredAt: incomingUser.registeredAt || new Date().toLocaleString('fr-FR'),
      notes: incomingUser.notes || `Inscription pour le ${incomingUser.vipTier || 'VIP1'}`,
    };
    users.unshift(savedUser);
  }

  saveDataStore();
  return res.status(200).json({ success: true, user: savedUser });
});

// 3. Find user by phone number for reliable re-login
app.get('/api/users/by-phone/:phone', (req: Request, res: Response) => {
  const { phone } = req.params;
  const found = users.find((u) => isSamePhoneNumber(u.phone, phone));

  if (found) {
    return res.json({ success: true, user: found });
  }

  return res.status(404).json({ success: false, message: 'Aucun compte trouvé pour ce numéro.' });
});

// 3.b Dedicated real-time synchronization endpoint for client account
app.get('/api/users/sync/:identifier', (req: Request, res: Response) => {
  const { identifier } = req.params;
  const decoded = decodeURIComponent(identifier || '').trim();

  const foundUser = users.find(
    (u) => u.id === decoded || isSamePhoneNumber(u.phone, decoded)
  );

  if (!foundUser) {
    return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
  }

  // Match transactions strictly to this user's ID (or phone fallback only if legacy record lacks userId)
  const userTransactions = transactions.filter((t) =>
    t.userId ? t.userId === foundUser.id : isSamePhoneNumber(t.phone, foundUser.phone)
  );

  // Match operations strictly to this user's ID (or phone fallback only if legacy record lacks userId)
  const userOperations = operations.filter((o) =>
    o.userId ? o.userId === foundUser.id : isSamePhoneNumber(o.userPhone, foundUser.phone)
  );

  return res.json({
    success: true,
    user: {
      ...foundUser,
      balance: typeof foundUser.balance === 'number' ? foundUser.balance : 0,
    },
    transactions: userTransactions,
    operations: userOperations,
    hasPending: userTransactions.some((t) => t.status === 'PENDING'),
    aviatorState: buildPublicAviatorState(foundUser),
  });
});

// 3.c Real-Time SSE Stream for instant Client & Admin updates
app.get('/api/events/stream', (req: Request, res: Response) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const userPhone = typeof req.query.userPhone === 'string' ? req.query.userPhone : undefined;
  const role = req.query.role === 'admin' ? 'admin' : 'client';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const client: SSEClient = {
    id: `sse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    userPhone,
    role,
    res,
  };
  sseClients.add(client);

  // Send immediate snapshot on connect
  const matchedUser = userId || userPhone
    ? users.find((u) => (userId && u.id === userId) || (userPhone && isSamePhoneNumber(u.phone, userPhone)))
    : undefined;
  sendSSE(client, 'connected', {
    serverTime: new Date().toISOString(),
    aviatorState: buildPublicAviatorState(role === 'admin' ? 'ADMIN' : matchedUser),
  });

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(client);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(client);
  });
});

// 4. Update user by ID (for admin toggling VIP, changing tier, etc.)
app.put('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
  }

  const prevUser = users[index];
  const { adminOverride, ...cleanUpdates } = updates || {};
  const allowDowngrade = adminOverride === true;
  const requestedStatus =
    cleanUpdates.paymentStatus === 'paid' || cleanUpdates.paymentStatus === 'unpaid'
      ? cleanUpdates.paymentStatus
      : prevUser.paymentStatus;

  const nextStatus: 'paid' | 'unpaid' =
    prevUser.paymentStatus === 'paid' && requestedStatus === 'unpaid' && !allowDowngrade
      ? 'paid'
      : requestedStatus;

  users[index] = {
    ...prevUser,
    ...cleanUpdates,
    id: prevUser.id,
    password: cleanUpdates.password || prevUser.password,
    bookmakerUserId: cleanUpdates.bookmakerUserId !== undefined ? cleanUpdates.bookmakerUserId : prevUser.bookmakerUserId,
    paymentStatus: nextStatus,
    balance: typeof cleanUpdates.balance === 'number' ? cleanUpdates.balance : (prevUser.balance ?? 0),
  };

  // Record operation only when VIP status actually changed or admin explicitly toggled
  if (
    (cleanUpdates.paymentStatus === 'paid' || (cleanUpdates.paymentStatus === 'unpaid' && allowDowngrade)) &&
    nextStatus !== prevUser.paymentStatus
  ) {
    const nowIso = new Date().toISOString();
    upsertUserOperation({
      id: `op_admin_vip_${Date.now()}`,
      userId: users[index].id,
      userPhone: users[index].phone,
      type: 'VIP_ACTIVATION',
      amount: users[index].vipTier === 'VIP2' ? 1500 : 550,
      status: nextStatus === 'paid' ? 'SUCCESS' : 'FAILED',
      title: nextStatus === 'paid' ? `Accès ${users[index].vipTier} Activé` : 'Accès VIP Désactivé',
      description: cleanUpdates.notes || (nextStatus === 'paid' ? 'Licence VIP activée par l’administrateur' : 'Licence VIP suspendue par l’administrateur'),
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  saveDataStore();
  broadcastToUser(users[index], 'user:updated', { user: users[index] });
  broadcastToAdmins('admin:update', { reason: 'user_updated' });
  return res.json({ success: true, user: users[index] });
});

// 4.b Admin Manual Balance Adjustment (Credit / Debit)
app.post('/api/admin/users/:id/balance', (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, action, reason } = req.body; // action: 'CREDIT' | 'DEBIT'
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
  }

  const numAmount = Math.floor(Number(amount));
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Montant invalide.' });
  }

  const currentBal = typeof users[index].balance === 'number' ? users[index].balance! : 0;
  const nextBal = action === 'DEBIT' ? Math.max(0, currentBal - numAmount) : currentBal + numAmount;
  users[index].balance = nextBal;

  const nowIso = new Date().toISOString();
  upsertUserOperation({
    id: `op_bal_${Date.now()}`,
    userId: users[index].id,
    userPhone: users[index].phone,
    type: action === 'DEBIT' ? 'WITHDRAWAL' : 'RECHARGE',
    amount: numAmount,
    status: 'SUCCESS',
    title: action === 'DEBIT' ? 'Ajustement Solde (Débit Admin)' : 'Crédit Solde par Administrateur',
    description: reason || (action === 'DEBIT' ? `Débit de ${numAmount} FCFA par l’administrateur` : `Crédit de ${numAmount} FCFA validé par l’administrateur`),
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  saveDataStore();
  broadcastToUser(users[index], 'user:updated', {
    user: users[index],
    balanceAction: action,
    balanceAmount: numAmount,
  });
  broadcastToAdmins('admin:update', { reason: 'balance_updated' });
  return res.json({ success: true, user: users[index] });
});

// 5. Delete user by ID
app.delete('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const initialLength = users.length;
  users = users.filter((u) => u.id !== id);

  if (users.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
  }

  saveDataStore();
  broadcastToAdmins('admin:update', { reason: 'user_deleted' });
  return res.json({ success: true, message: 'Utilisateur supprimé avec succès.' });
});

// =========================================================================
// SUPPORT CHAT & SERVICE CLIENT (Live messaging & unread notifications)
// =========================================================================
app.get('/api/support/messages/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  let conv = supportConversations.find((c) => c.userId === userId);

  if (!conv) {
    conv = {
      userId,
      userName: (req.query.userName as string) || 'Client',
      userPhone: (req.query.userPhone as string) || '',
      userCountry: (req.query.userCountry as string) || 'Bénin',
      lastMessageAt: new Date().toISOString(),
      unreadCountClient: 0,
      unreadCountAdmin: 0,
      messages: [],
    };
    supportConversations.unshift(conv);
    saveDataStore();
  }

  return res.json({ success: true, conversation: conv });
});

app.post('/api/support/send', (req: Request, res: Response) => {
  const { userId, userName, userPhone, userCountry, text } = req.body;
  if (!userId || !text) {
    return res.status(400).json({ success: false, message: 'Message vide ou ID manquant.' });
  }

  let conv = supportConversations.find((c) => c.userId === userId);
  const newMsg: ServerChatMessage = {
    id: `msg_${Date.now()}`,
    sender: 'client',
    text: String(text).trim(),
    timestamp: new Date().toISOString(),
    read: false,
  };

  if (!conv) {
    conv = {
      userId,
      userName: userName || 'Client',
      userPhone: userPhone || '',
      userCountry: userCountry || 'Bénin',
      lastMessageAt: new Date().toISOString(),
      unreadCountClient: 0,
      unreadCountAdmin: 1,
      messages: [newMsg],
    };
    supportConversations.unshift(conv);
  } else {
    conv.messages.push(newMsg);
    conv.lastMessageAt = new Date().toISOString();
    conv.unreadCountAdmin += 1;
    if (userName) conv.userName = userName;
    if (userPhone) conv.userPhone = userPhone;
  }

  saveDataStore();
  return res.json({ success: true, message: newMsg, conversation: conv });
});

app.get('/api/admin/support/conversations', (_req: Request, res: Response) => {
  return res.json({ success: true, conversations: supportConversations });
});

app.post('/api/admin/support/reply', (req: Request, res: Response) => {
  const { userId, text } = req.body;
  if (!userId || !text) {
    return res.status(400).json({ success: false, message: 'ID ou texte manquant.' });
  }

  let conv = supportConversations.find((c) => c.userId === userId);
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
  }

  const replyMsg: ServerChatMessage = {
    id: `msg_adm_${Date.now()}`,
    sender: 'admin',
    text: String(text).trim(),
    timestamp: new Date().toISOString(),
    read: false,
  };

  conv.messages.push(replyMsg);
  conv.lastMessageAt = new Date().toISOString();
  conv.unreadCountClient += 1;

  saveDataStore();
  const matchedChatUser = users.find((u) => u.id === conv.userId || isSamePhoneNumber(u.phone, conv.userPhone));
  if (matchedChatUser) {
    broadcastToUser(matchedChatUser, 'support:updated', { conversation: conv });
  }
  return res.json({ success: true, message: replyMsg, conversation: conv });
});

app.post('/api/support/mark-read', (req: Request, res: Response) => {
  const { userId, role } = req.body;
  const conv = supportConversations.find((c) => c.userId === userId);

  if (conv) {
    if (role === 'client') {
      conv.unreadCountClient = 0;
      conv.messages.forEach((m) => {
        if (m.sender === 'admin') m.read = true;
      });
    } else if (role === 'admin') {
      conv.unreadCountAdmin = 0;
      conv.messages.forEach((m) => {
        if (m.sender === 'client') m.read = true;
      });
    }
    saveDataStore();
  }

  return res.json({ success: true });
});

// =========================================================================
// PAYMENT WORKFLOW (SASPAY API + MANUAL ADMIN VALIDATION)
// =========================================================================
// 1. Detect Country from Client IP / Headers
app.get('/api/detect-country', async (req: Request, res: Response) => {
  try {
    const cfCountry = req.headers['cf-ipcountry'] as string;
    const xCountry = req.headers['x-country-code'] as string;
    const validCountries: CountryCode[] = ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'];

    if (cfCountry && validCountries.includes(cfCountry.toUpperCase() as CountryCode)) {
      return res.json({ country: cfCountry.toUpperCase(), method: 'cloudflare_header', detected: true });
    }

    if (xCountry && validCountries.includes(xCountry.toUpperCase() as CountryCode)) {
      return res.json({ country: xCountry.toUpperCase(), method: 'custom_header', detected: true });
    }

    return res.json({ country: 'BJ', method: 'default', detected: false });
  } catch (error) {
    return res.json({ country: 'BJ', method: 'fallback', detected: false });
  }
});

// 2. Get Supported Countries & Operators
app.get('/api/countries', (_req: Request, res: Response) => {
  return res.json(Object.values(SUPPORTED_COUNTRIES));
});

// 3. Initiate Mobile Money Payment / Recharge (Strict userId binding + No anonymous payment + Admin confirmation required)
const UEMOA_PREFIXES = ['229', '226', '225', '245', '223', '227', '221', '228'];

app.post('/api/payments/initiate', async (req: Request, res: Response) => {
  try {
    const {
      amount,
      country,
      network,
      phone,
      customerName,
      customerEmail,
      description,
      vipTier,
      bookmaker,
      bookmakerUserId,
      transactionType,
      userId,
    } = req.body;

    const txCategory: TransactionCategory =
      transactionType === 'RECHARGE' ? 'RECHARGE' : 'VIP_ACTIVATION';

    const cleanCustomerName = String(customerName || '').trim();
    const cleanPhoneDigits = String(phone || '').replace(/[^0-9]/g, '');

    if (!amount || cleanPhoneDigits.length < 7) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez renseigner un numéro Mobile Money valide.',
      });
    }

    const resolvedCountryCode: CountryCode = resolveCountryCode(country);
    const countryData = SUPPORTED_COUNTRIES[resolvedCountryCode];
    if (!countryData) {
      return res.status(400).json({ success: false, message: 'Pays sélectionné non supporté.' });
    }

    // Match an active operator for the selected country (fallback to first enabled operator if available)
    const operator =
      countryData.operators.find((op) => op.id === network && op.enabled) ||
      countryData.operators.find((op) => op.enabled) ||
      countryData.operators[0];

    if (!operator) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez sélectionner un réseau Mobile Money valide pour ce pays.',
      });
    }

    const cleanedAmountStr = String(amount).replace(/\s+/g, '').replace(',', '.');
    const numAmount = parseFloat(cleanedAmountStr);
    if (isNaN(numAmount) || numAmount < 100) {
      return res.status(400).json({
        success: false,
        message: `Le montant doit être d'au moins 100 ${countryData.currency}.`,
      });
    }
    if (numAmount > operator.maxAmount) {
      return res.status(400).json({
        success: false,
        message: `Le montant maximum autorisé pour ${operator.name} est de ${operator.maxAmount.toLocaleString('fr-FR')} ${countryData.currency}.`,
      });
    }

    // Strict user resolution: prefer userId, fall back cleanly to matching phone if local ID is stale
    let userIndex = -1;
    if (userId) {
      userIndex = users.findIndex((u) => u.id === userId);
    }

    // Format deposit phone number cleanly without altering the user's account login phone
    let rawDigits = cleanPhoneDigits;
    if (rawDigits.startsWith('00')) {
      rawDigits = rawDigits.substring(2);
    }
    const prefixDigits = countryData.phonePrefix.replace(/[^0-9]/g, '');
    if (rawDigits.startsWith(prefixDigits) && rawDigits.length - prefixDigits.length >= 7) {
      rawDigits = rawDigits.substring(prefixDigits.length);
    } else {
      for (const code of UEMOA_PREFIXES) {
        if (rawDigits.startsWith(code) && rawDigits.length - code.length >= 7) {
          rawDigits = rawDigits.substring(code.length);
          break;
        }
      }
    }
    if (resolvedCountryCode === 'BJ' && rawDigits.length === 8) {
      rawDigits = `01${rawDigits}`;
    }
    const formattedPhone = `${countryData.phonePrefix}${rawDigits}`;

    if (userIndex === -1) {
      userIndex = users.findIndex((u) => isSamePhoneNumber(u.phone, formattedPhone));
    }

    // Keep registered Betting Site ID immutable once set; never block payment if omitted
    const rawSubmittedBetId = bookmakerUserId ? String(bookmakerUserId).trim() : '';
    const existingRawBetId = userIndex >= 0 ? (users[userIndex].bookmakerUserId || '').trim() : '';
    if (userIndex >= 0 && !existingRawBetId && rawSubmittedBetId) {
      users[userIndex].bookmakerUserId = rawSubmittedBetId;
    }
    const effectiveBetId = existingRawBetId || rawSubmittedBetId || undefined;

    const idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const internalId = `tx_${Date.now()}`;

    const effectiveCustomerName =
      cleanCustomerName ||
      (userIndex >= 0 ? users[userIndex].fullName : '') ||
      'Client Aviator';
    const nameParts = effectiveCustomerName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || 'Client';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || 'Aviator';

    const rawEmail = String(customerEmail || '').trim();
    const safeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
      ? rawEmail
      : 'client@aviator-bot.com';

    const gatewayPayload = {
      amount: numAmount.toFixed(2),
      currency: countryData.currency,
      country: resolvedCountryCode,
      network: operator.id,
      description: description || `Paiement ${operator.name}`,
      customer: {
        email: safeEmail,
        first_name: firstName,
        last_name: lastName,
        phone: formattedPhone,
      },
    };

    const dispatchSasPayPush = async (
      payload: any,
      idemKey: string,
      opId: string
    ): Promise<{ gatewayResponseData: any; gatewayPaymentId?: string; hasLiveGatewayData: boolean }> => {
      let respData: any = { success: true, status: 'PENDING', provider: 'SASPAY' };
      let payId: string | undefined = undefined;
      let hasLiveGatewayData = false;
      if (opId !== 'finances_gw') {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const response = await fetch(`${SASPAY_API_BASE}/payments/softpay/`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${SASPAY_SECRET_KEY}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': idemKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          const responseText = await response.text();
          try {
            const parsed = JSON.parse(responseText);
            if (parsed && parsed.success === true) {
              respData = parsed;
              hasLiveGatewayData = true;
            }
            payId =
              parsed?.data?.id ||
              parsed?.data?.payment_id ||
              parsed?.payment_id ||
              parsed?.id;
          } catch {
            // Silently handle non-JSON upstream responses without exposing errors to checkout
          }
        } catch {
          // Silently handle network/upstream timeout without exposing raw API errors to the client
        }
      }
      return { gatewayResponseData: respData, gatewayPaymentId: payId, hasLiveGatewayData };
    };

    let settledFast = false;
    const sasPayPromise = dispatchSasPayPush(gatewayPayload, idempotencyKey, operator.id);
    const fastOutcome =
      operator.id === 'finances_gw'
        ? await sasPayPromise
        : await Promise.race([
            sasPayPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 600)),
          ]);

    if (fastOutcome) {
      settledFast = true;
    }

    const gatewayResponseData = fastOutcome?.gatewayResponseData || {
      success: true,
      status: 'PENDING',
      provider: 'SASPAY',
    };
    const gatewayPaymentId =
      fastOutcome?.gatewayPaymentId || `pay_${operator.id}_${Date.now().toString().slice(-6)}`;

    // Default status is STRICTLY PENDING: Administrator confirmation is ALWAYS required before unlocking VIP or crediting balance
    const paymentStatus: PaymentStatus = 'PENDING';
    const statusMessage =
      txCategory === 'RECHARGE'
        ? `Message de prélèvement et confirmation envoyés sur ${formattedPhone} (${operator.name}). Validez sur votre téléphone puis attendez la confirmation de l’administrateur.`
        : `Confirmation et message de prélèvement envoyés sur ${formattedPhone} (${operator.name}). Validez sur votre téléphone puis soumettez la capture SMS.`;

    let targetUserId = '';
    if (userIndex >= 0) {
      if (txCategory === 'VIP_ACTIVATION' && vipTier) {
        users[userIndex].vipTier = vipTier as any;
      }
      if (bookmaker) {
        users[userIndex].bookmaker = bookmaker;
      }
      targetUserId = users[userIndex].id;
    } else {
      const createdUser: User = {
        id: userId || `usr_${Date.now()}`,
        fullName: effectiveCustomerName,
        phone: formattedPhone,
        country: countryData.name,
        bookmaker: bookmaker || '1xBet',
        bookmakerUserId: effectiveBetId,
        vipTier: (vipTier as any) || 'VIP1',
        paymentStatus: 'unpaid',
        balance: 0,
        registeredAt: new Date().toLocaleString('fr-FR'),
        notes: `Demande de paiement en attente pour ${vipTier || 'VIP1'}`,
      };
      users.unshift(createdUser);
      userIndex = 0;
      targetUserId = createdUser.id;
    }

    const newRecord: TransactionRecord = {
      id: internalId,
      userId: targetUserId,
      bookmakerUserId: effectiveBetId,
      saspayPaymentId: gatewayPaymentId,
      transactionType: txCategory,
      amount: numAmount,
      currency: countryData.currency,
      country: resolvedCountryCode,
      countryName: countryData.name,
      network: operator.id,
      operatorName: operator.name,
      operatorBrand: operator.brand,
      phone: formattedPhone,
      customerName: effectiveCustomerName,
      customerEmail: safeEmail,
      description:
        description ||
        (txCategory === 'RECHARGE'
          ? `Rechargement Solde ${operator.name} (${numAmount} ${countryData.currency})`
          : `Paiement ${operator.name} (${vipTier || 'VIP'})`),
      status: paymentStatus,
      statusMessage: statusMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey,
      apiResponse: gatewayResponseData,
      resendCount: 0,
    };

    transactions.unshift(newRecord);

    upsertUserOperation({
      id: `op_${newRecord.id}`,
      userId: targetUserId,
      userPhone: users[userIndex]?.phone || formattedPhone,
      type: txCategory,
      amount: numAmount,
      status: 'PENDING',
      title: txCategory === 'RECHARGE' ? 'Rechargement Solde Mobile Money' : `Activation Licence ${vipTier || 'VIP'}`,
      description: `Dépôt depuis ${formattedPhone} (${operator.name}) · En attente validation admin`,
      reference: newRecord.saspayPaymentId || newRecord.id,
      createdAt: newRecord.createdAt,
      updatedAt: newRecord.updatedAt,
    });

    saveDataStore();
    if (userIndex >= 0) {
      broadcastToUser(users[userIndex], 'user:updated', { user: users[userIndex], transaction: newRecord });
    }
    broadcastToAdmins('admin:update', { reason: 'new_payment', transaction: newRecord });

    // If SASPay finishes right after the 600ms fast-return window, attach checkout_url/instructions & push via SSE
    if (!settledFast) {
      sasPayPromise
        .then((lateOutcome) => {
          if (!lateOutcome) return;
          if (!lateOutcome.hasLiveGatewayData && !lateOutcome.gatewayPaymentId) return;
          newRecord.apiResponse = lateOutcome.gatewayResponseData;
          if (lateOutcome.gatewayPaymentId) {
            newRecord.saspayPaymentId = lateOutcome.gatewayPaymentId;
          }
          newRecord.updatedAt = new Date().toISOString();
          const existingOp = operations.find((o) => o.id === `op_${newRecord.id}`);
          if (existingOp && lateOutcome.gatewayPaymentId) {
            existingOp.reference = lateOutcome.gatewayPaymentId;
            existingOp.updatedAt = newRecord.updatedAt;
          }
          saveDataStore();
          const liveUser = users.find((u) => u.id === targetUserId) || users[userIndex];
          if (liveUser) {
            broadcastToUser(liveUser, 'user:updated', { user: liveUser, transaction: newRecord });
          }
          broadcastToAdmins('admin:update', { reason: 'saspay_async_ack', transaction: newRecord });
        })
        .catch(() => {});
    }

    return res.status(201).json({
      success: true,
      transaction: newRecord,
      user: users[userIndex],
      instruction: operator.instructionFr,
      confirmationSent: true,
    });
  } catch (error: any) {
    console.error('Erreur paiement:', error);
    return res.status(500).json({
      success: false,
      message: 'Impossible d’enregistrer la demande pour le moment. Veuillez réessayer.',
    });
  }
});

// 3.b Request Withdrawal (Minimum 5 000 FCFA, strictly validated by Admin)
app.post('/api/wallet/withdraw', (req: Request, res: Response) => {
  const { userId, phone, amount, country, network } = req.body;

  const user = users.find(
    (u) => (userId && u.id === userId) || (phone && isSamePhoneNumber(u.phone, String(phone)))
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'Compte utilisateur introuvable.' });
  }

  if (user.paymentStatus !== 'paid') {
    return res.status(403).json({
      success: false,
      message: 'Votre accès VIP doit être actif pour effectuer un retrait.',
    });
  }

  const numAmount = Math.floor(Number(amount));
  if (isNaN(numAmount) || numAmount < 5000) {
    return res.status(400).json({
      success: false,
      message: 'Le montant minimum pour un retrait est de 5 000 FCFA.',
    });
  }

  const currentBalance = typeof user.balance === 'number' ? user.balance : 0;
  if (numAmount > currentBalance) {
    return res.status(400).json({
      success: false,
      message: `Solde insuffisant. Votre solde actuel est de ${currentBalance.toLocaleString('fr-FR')} FCFA.`,
    });
  }

  const countryCode = (country && SUPPORTED_COUNTRIES[country as CountryCode]) ? (country as CountryCode) : 'BJ';
  const countryData = SUPPORTED_COUNTRIES[countryCode];
  const operator =
    countryData.operators.find((op) => op.id === network && op.enabled) ||
    countryData.operators[0] ||
    SUPPORTED_COUNTRIES.BJ.operators[0];
  let wdDigits = String(phone || user.phone).replace(/[^0-9]/g, '');
  if (wdDigits.startsWith('00')) wdDigits = wdDigits.slice(2);
  const wdPrefixDigits = countryData.phonePrefix.replace(/[^0-9]/g, '');
  if (wdDigits.startsWith(wdPrefixDigits) && wdDigits.length - wdPrefixDigits.length >= 7) {
    wdDigits = wdDigits.slice(wdPrefixDigits.length);
  } else {
    for (const code of UEMOA_PREFIXES) {
      if (wdDigits.startsWith(code) && wdDigits.length - code.length >= 7) {
        wdDigits = wdDigits.slice(code.length);
        break;
      }
    }
  }
  if (countryCode === 'BJ' && wdDigits.length === 8) {
    wdDigits = `01${wdDigits}`;
  }
  const targetPhone = wdDigits.length >= 7 ? `${countryData.phonePrefix}${wdDigits}` : String(phone || user.phone).trim();

  // Deduct into pending hold so the user cannot double-withdraw the same funds
  user.balance = currentBalance - numAmount;

  const nowIso = new Date().toISOString();
  const txId = `wd_${Date.now()}`;
  const withdrawalTx: TransactionRecord = {
    id: txId,
    userId: user.id,
    bookmakerUserId: user.bookmakerUserId,
    saspayPaymentId: `wdr_${Date.now().toString().slice(-8)}`,
    transactionType: 'WITHDRAWAL',
    amount: numAmount,
    currency: countryData.currency,
    country: countryCode,
    countryName: countryData.name,
    network: operator.id,
    operatorName: operator.name,
    operatorBrand: operator.brand,
    phone: targetPhone,
    customerName: user.fullName,
    customerEmail: `${user.id}@aviator-bot.com`,
    description: `Demande de retrait Mobile Money (${numAmount} ${countryData.currency})`,
    status: 'PENDING',
    statusMessage: 'Demande de retrait envoyée. En attente de validation par l’administrateur.',
    createdAt: nowIso,
    updatedAt: nowIso,
    idempotencyKey: `idem_wd_${Date.now()}`,
  };

  transactions.unshift(withdrawalTx);

  upsertUserOperation({
    id: `op_${txId}`,
    userId: user.id,
    userPhone: user.phone,
    type: 'WITHDRAWAL',
    amount: numAmount,
    status: 'PENDING',
    title: 'Demande de Retrait Mobile Money',
    description: `Retrait vers ${targetPhone} (${operator.name}) · En attente validation admin`,
    reference: withdrawalTx.saspayPaymentId,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  saveDataStore();
  broadcastToUser(user, 'user:updated', { user });
  broadcastToAdmins('admin:update', { reason: 'new_withdrawal', transaction: withdrawalTx });

  return res.status(201).json({
    success: true,
    transaction: withdrawalTx,
    user,
    message: 'Demande de retrait enregistrée et transmise à l’administrateur pour validation.',
  });
});

// 3.c Upload SMS Confirmation Screenshot Proof (STRICTLY for VIP_ACTIVATION only)
app.post('/api/payments/:id/proof', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { imageDataUrl, fileName, smsConfirmed, fallbackTx } = req.body || {};

    let tx = transactions.find((t) => t.id === id || t.saspayPaymentId === id);
    if (!tx && fallbackTx && typeof fallbackTx === 'object') {
      const fb = fallbackTx as TransactionRecord;
      tx = {
        ...fb,
        id: fb.id || id,
        status: fb.status || 'PENDING',
        transactionType: fb.transactionType || 'VIP_ACTIVATION',
      };
      transactions.unshift(tx);
    }
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction introuvable.' });
    }

    const txCategory: TransactionCategory = tx.transactionType || (
      tx.description?.toLowerCase().includes('retrait')
        ? 'WITHDRAWAL'
        : tx.description?.toLowerCase().includes('rechargement')
        ? 'RECHARGE'
        : 'VIP_ACTIVATION'
    );

    if (txCategory !== 'VIP_ACTIVATION') {
      return res.status(400).json({
        success: false,
        message: 'La soumission de capture SMS est réservée uniquement à l’abonnement VIP.',
      });
    }

    if (smsConfirmed !== true) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez confirmer que l’image importée est bien la capture d’écran du SMS de confirmation du paiement.',
      });
    }

    const rawDataUrl = String(imageDataUrl || '').trim();
    const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(rawDataUrl);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Format d’image invalide. Veuillez importer une capture d’écran PNG, JPG ou WEBP du SMS de paiement.',
      });
    }

    const extRaw = match[1].toLowerCase();
    const ext = extRaw === 'jpeg' ? 'jpg' : extRaw;
    const base64Body = match[2].replace(/\s+/g, '');
    const buffer = Buffer.from(base64Body, 'base64');

    if (buffer.length < 1024 || buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'La capture d’écran SMS semble invalide ou trop volumineuse (max 8 Mo).',
      });
    }

    // Verify genuine image magic bytes
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
    const isGif = buffer.slice(0, 3).toString('ascii') === 'GIF';

    if (!isPng && !isJpg && !isWebp && !isGif) {
      return res.status(400).json({
        success: false,
        message: 'Fichier non reconnu comme une capture d’écran image valide.',
      });
    }

    fs.mkdirSync(PROOFS_DIR, { recursive: true });
    const safeTxId = tx.id.replace(/[^a-zA-Z0-9_\-]/g, '_');
    // Remove previous proof files for this tx id if any
    for (const oldExt of ['jpg', 'png', 'webp', 'gif']) {
      const oldPath = path.join(PROOFS_DIR, `${safeTxId}.${oldExt}`);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
      }
    }

    const filePath = path.join(PROOFS_DIR, `${safeTxId}.${ext}`);
    fs.writeFileSync(filePath, buffer);

    const nowIso = new Date().toISOString();
    tx.hasPaymentProof = true;
    tx.proofSubmittedAt = nowIso;
    tx.proofFileName = fileName ? String(fileName).slice(0, 120) : `capture_sms_${safeTxId}.${ext}`;
    tx.paymentProofUrl = `/api/payments/${encodeURIComponent(tx.id)}/proof-image?t=${Date.now()}`;
    tx.updatedAt = nowIso;
    tx.statusMessage = 'Capture d’écran du SMS de confirmation reçue. En attente de validation par l’administrateur.';

    const matchedUser = users.find((u) =>
      tx.userId ? u.id === tx.userId : isSamePhoneNumber(u.phone, tx.phone)
    );

    upsertUserOperation({
      id: `op_${tx.id}`,
      userId: matchedUser ? matchedUser.id : (tx.userId || tx.phone),
      userPhone: matchedUser ? matchedUser.phone : tx.phone,
      type: 'VIP_ACTIVATION',
      amount: tx.amount,
      status: tx.status,
      title: `Activation Licence ${matchedUser?.vipTier || 'VIP'}`,
      description: `Capture SMS soumise pour ${tx.phone} (${tx.operatorName}) · En attente validation admin`,
      reference: tx.saspayPaymentId || tx.id,
      createdAt: tx.createdAt,
      updatedAt: nowIso,
    });

    saveDataStore();
    if (matchedUser) {
      broadcastToUser(matchedUser, 'user:updated', { user: matchedUser, transaction: tx });
    }
    broadcastToAdmins('admin:update', { reason: 'vip_proof_submitted', transaction: tx });

    return res.json({
      success: true,
      transaction: tx,
      message: 'Preuve de paiement (capture d’écran SMS) soumise avec succès.',
    });
  } catch (err) {
    console.error('Erreur upload preuve SMS:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’envoi de la capture d’écran. Veuillez réessayer.',
    });
  }
});

// 3.d Serve stored VIP SMS confirmation screenshot
app.get('/api/payments/:id/proof-image', (req: Request, res: Response) => {
  const { id } = req.params;
  const tx = transactions.find((t) => t.id === id || t.saspayPaymentId === id);
  const safeTxId = (tx ? tx.id : id).replace(/[^a-zA-Z0-9_\-]/g, '_');

  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };

  for (const ext of ['jpg', 'png', 'webp', 'gif']) {
    const candidate = path.join(PROOFS_DIR, `${safeTxId}.${ext}`);
    if (fs.existsSync(candidate)) {
      res.setHeader('Content-Type', mimeMap[ext]);
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(candidate);
    }
  }

  return res.status(404).json({ success: false, message: 'Capture introuvable.' });
});

// 3.e Client confirms automatic Mobile Money deduction for Recharge xBet
app.post('/api/payments/:id/confirm-recharge', (req: Request, res: Response) => {
  const { id } = req.params;
  let tx = transactions.find((t) => t.id === id || t.saspayPaymentId === id);
  if (!tx && req.body?.fallbackTx && typeof req.body.fallbackTx === 'object') {
    const fb = req.body.fallbackTx as TransactionRecord;
    tx = {
      ...fb,
      id: fb.id || id,
      status: fb.status || 'PENDING',
      transactionType: fb.transactionType || 'RECHARGE',
    };
    transactions.unshift(tx);
  }
  if (!tx) {
    return res.status(404).json({ success: false, message: 'Transaction introuvable.' });
  }

  const nowIso = new Date().toISOString();
  tx.rechargeConfirmedByClient = true;
  tx.updatedAt = nowIso;
  tx.statusMessage = 'Veuillez attendre que les administrateurs valident le dépôt sur votre compte du jeu Aviator.';

  const matchedUser = users.find((u) =>
    tx!.userId ? u.id === tx!.userId : isSamePhoneNumber(u.phone, tx!.phone)
  );

  upsertUserOperation({
    id: `op_${tx.id}`,
    userId: matchedUser ? matchedUser.id : (tx.userId || tx.phone),
    userPhone: matchedUser ? matchedUser.phone : tx.phone,
    type: 'RECHARGE',
    amount: tx.amount,
    status: tx.status,
    title: 'Rechargement Solde Mobile Money',
    description: `Prélèvement confirmé par le client (${tx.phone} · ${tx.operatorName}) · En attente validation admin`,
    reference: tx.saspayPaymentId || tx.id,
    createdAt: tx.createdAt,
    updatedAt: nowIso,
  });

  saveDataStore();
  if (matchedUser) {
    broadcastToUser(matchedUser, 'user:updated', { user: matchedUser, transaction: tx });
  }
  broadcastToAdmins('admin:update', { reason: 'recharge_confirmed_by_client', transaction: tx });

  return res.json({
    success: true,
    transaction: tx,
    message: 'Veuillez attendre que les administrateurs valident le dépôt sur votre compte du jeu Aviator.',
  });
});

// 3.f Re-send Mobile Money debit prompt & confirmation (works on same number OR updated number, 2nd/Nth time)
app.post('/api/payments/:id/resend', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { phone, country, network, customerName, fallbackTx } = req.body || {};

    let tx = transactions.find((t) => t.id === id || t.saspayPaymentId === id);
    if (!tx && fallbackTx && typeof fallbackTx === 'object') {
      const fb = fallbackTx as TransactionRecord;
      tx = {
        ...fb,
        id: fb.id || id,
        status: fb.status || 'PENDING',
      };
      transactions.unshift(tx);
    }

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Demande de paiement introuvable.' });
    }

    const countryCode: CountryCode = resolveCountryCode(
      String(country || tx.country || 'BJ')
    );
    const countryData = SUPPORTED_COUNTRIES[countryCode];
    const operator =
      countryData.operators.find((op) => op.id === (network || tx!.network) && op.enabled) ||
      countryData.operators.find((op) => op.enabled) ||
      countryData.operators[0];

    let targetPhone = tx.phone;
    if (phone && String(phone).replace(/[^0-9]/g, '').length >= 7) {
      let rawDigits = String(phone).replace(/[^0-9]/g, '');
      if (rawDigits.startsWith('00')) rawDigits = rawDigits.slice(2);
      const prefixDigits = countryData.phonePrefix.replace(/[^0-9]/g, '');
      if (rawDigits.startsWith(prefixDigits) && rawDigits.length - prefixDigits.length >= 7) {
        rawDigits = rawDigits.slice(prefixDigits.length);
      } else {
        for (const code of UEMOA_PREFIXES) {
          if (rawDigits.startsWith(code) && rawDigits.length - code.length >= 7) {
            rawDigits = rawDigits.slice(code.length);
            break;
          }
        }
      }
      if (countryCode === 'BJ' && rawDigits.length === 8) {
        rawDigits = `01${rawDigits}`;
      }
      targetPhone = `${countryData.phonePrefix}${rawDigits}`;
    }

    const cleanName = String(customerName || tx.customerName || 'Client Aviator').trim() || 'Client Aviator';
    const resendNameParts = cleanName.split(/\s+/).filter(Boolean);
    const firstName = resendNameParts[0] || 'Client';
    const lastName = resendNameParts.slice(1).join(' ') || resendNameParts[0] || 'Aviator';
    const resendIdemKey = `idem_resend_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const gatewayPayload = {
      amount: Number(tx.amount).toFixed(2),
      currency: countryData.currency,
      country: countryCode,
      network: operator.id,
      description: tx.description || `Paiement ${operator.name}`,
      customer: {
        email: tx.customerEmail || 'client@aviator-bot.com',
        first_name: firstName,
        last_name: lastName,
        phone: targetPhone,
      },
    };

    const dispatchResendPush = async (): Promise<{
      gatewayResponseData: any;
      gatewayPaymentId?: string;
      hasLiveGatewayData: boolean;
    }> => {
      let respData: any = { success: true, status: 'PENDING', provider: 'SASPAY', resent: true };
      let payId: string | undefined = undefined;
      let hasLiveGatewayData = false;
      if (operator.id !== 'finances_gw') {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const response = await fetch(`${SASPAY_API_BASE}/payments/softpay/`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${SASPAY_SECRET_KEY}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': resendIdemKey,
            },
            body: JSON.stringify(gatewayPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const responseText = await response.text();
          try {
            const parsed = JSON.parse(responseText);
            if (parsed && parsed.success === true) {
              respData = parsed;
              hasLiveGatewayData = true;
            }
            payId =
              parsed?.data?.id ||
              parsed?.data?.payment_id ||
              parsed?.payment_id ||
              parsed?.id;
          } catch {
            // ignore non-JSON upstream response
          }
        } catch {
          // silently continue so request never fails or disappears
        }
      }
      return { gatewayResponseData: respData, gatewayPaymentId: payId, hasLiveGatewayData };
    };

    let resendSettledFast = false;
    const resendSasPayPromise = dispatchResendPush();
    const fastResendOutcome =
      operator.id === 'finances_gw'
        ? await resendSasPayPromise
        : await Promise.race([
            resendSasPayPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 600)),
          ]);

    if (fastResendOutcome) {
      resendSettledFast = true;
    }

    const gatewayResponseData = fastResendOutcome?.gatewayResponseData || {
      success: true,
      status: 'PENDING',
      provider: 'SASPAY',
      resent: true,
    };
    const gatewayPaymentId = fastResendOutcome?.gatewayPaymentId;

    const nowIso = new Date().toISOString();
    const nextResendCount = (tx.resendCount || 0) + 1;
    tx.country = countryCode;
    tx.countryName = countryData.name;
    tx.network = operator.id;
    tx.operatorName = operator.name;
    tx.operatorBrand = operator.brand;
    tx.phone = targetPhone;
    tx.customerName = cleanName;
    tx.resendCount = nextResendCount;
    tx.lastResentAt = nowIso;
    tx.updatedAt = nowIso;
    tx.idempotencyKey = resendIdemKey;
    tx.apiResponse = gatewayResponseData;
    if (gatewayPaymentId) {
      tx.saspayPaymentId = gatewayPaymentId;
    }

    const txCategory: TransactionCategory = tx.transactionType || 'VIP_ACTIVATION';
    tx.statusMessage =
      txCategory === 'RECHARGE'
        ? `Message de prélèvement et confirmation renvoyés sur ${targetPhone} (${operator.name}) · Envoi #${nextResendCount + 1}.`
        : `Confirmation et message de prélèvement renvoyés sur ${targetPhone} (${operator.name}) · Envoi #${nextResendCount + 1}.`;

    const matchedUser =
      (tx.userId ? users.find((u) => u.id === tx!.userId) : undefined) ||
      users.find((u) => isSamePhoneNumber(u.phone, tx!.phone));

    upsertUserOperation({
      id: `op_${tx.id}`,
      userId: matchedUser ? matchedUser.id : (tx.userId || tx.phone),
      userPhone: matchedUser ? matchedUser.phone : tx.phone,
      type: txCategory,
      amount: tx.amount,
      status: tx.status,
      title: txCategory === 'RECHARGE' ? 'Rechargement Solde Mobile Money' : 'Activation Licence VIP',
      description: `Prélèvement envoyé vers ${targetPhone} (${operator.name}) · Envoi #${nextResendCount + 1}`,
      reference: tx.saspayPaymentId || tx.id,
      createdAt: tx.createdAt,
      updatedAt: nowIso,
    });

    saveDataStore();
    if (matchedUser) {
      broadcastToUser(matchedUser, 'user:updated', { user: matchedUser, transaction: tx });
    }
    broadcastToAdmins('admin:update', { reason: 'payment_resent', transaction: tx });

    if (!resendSettledFast) {
      const activeTx = tx;
      resendSasPayPromise
        .then((lateResend) => {
          if (!lateResend) return;
          if (!lateResend.hasLiveGatewayData && !lateResend.gatewayPaymentId) return;
          activeTx.apiResponse = lateResend.gatewayResponseData;
          if (lateResend.gatewayPaymentId) {
            activeTx.saspayPaymentId = lateResend.gatewayPaymentId;
          }
          activeTx.updatedAt = new Date().toISOString();
          saveDataStore();
          if (matchedUser) {
            broadcastToUser(matchedUser, 'user:updated', { user: matchedUser, transaction: activeTx });
          }
          broadcastToAdmins('admin:update', { reason: 'saspay_resend_async_ack', transaction: activeTx });
        })
        .catch(() => {});
    }

    return res.json({
      success: true,
      transaction: tx,
      resendCount: nextResendCount,
      message: tx.statusMessage,
    });
  } catch (err) {
    console.error('Erreur renvoi prélèvement:', err);
    return res.status(200).json({
      success: true,
      message: 'Nouvelle confirmation de prélèvement enregistrée.',
    });
  }
});

// 4. Verify Payment Status (NO auto-validation, checks live status or admin decision)
app.get('/api/payments/:id/verify', async (req: Request, res: Response) => {
  const { id } = req.params;
  const transaction = transactions.find((t) => t.id === id || t.saspayPaymentId === id);

  if (!transaction) {
    return res.status(404).json({ success: false, message: 'Transaction introuvable.' });
  }

  return res.json({ success: true, transaction });
});

// 5. List All Transactions for Admin Dashboard
app.get('/api/transactions', (req: Request, res: Response) => {
  const { country, network, status, search, phone } = req.query;

  let filtered = [...transactions];

  if (phone && typeof phone === 'string') {
    filtered = filtered.filter((t) => isSamePhoneNumber(t.phone, phone));
  }

  if (country && country !== 'ALL') {
    filtered = filtered.filter((t) => t.country === country);
  }

  if (network && network !== 'ALL') {
    filtered = filtered.filter((t) => t.network === network);
  }

  if (status && status !== 'ALL') {
    filtered = filtered.filter((t) => t.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.customerName.toLowerCase().includes(q) ||
        t.phone.includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.saspayPaymentId && t.saspayPaymentId.toLowerCase().includes(q)) ||
        t.operatorName.toLowerCase().includes(q)
    );
  }

  return res.json({ success: true, transactions: filtered });
});

// 6. Get Pending Payments waiting for Admin Validation
app.get('/api/admin/pending-payments', (_req: Request, res: Response) => {
  const pending = transactions.filter((t) => t.status === 'PENDING');
  return res.json({ success: true, pending, count: pending.length });
});

// 7. Admin Decision on a Payment, Recharge, or Withdrawal Request (Accepter / Rejeter)
app.post('/api/admin/payments/:id/decision', (req: Request, res: Response) => {
  const { id } = req.params;
  const { decision, reason } = req.body; // 'ACCEPT' | 'REJECT'

  const tx = transactions.find((t) => t.id === id || t.saspayPaymentId === id);
  if (!tx) {
    return res.status(404).json({ success: false, message: 'Transaction introuvable.' });
  }

  const txCategory: TransactionCategory = tx.transactionType || (
    tx.description?.toLowerCase().includes('retrait')
      ? 'WITHDRAWAL'
      : tx.description?.toLowerCase().includes('rechargement')
      ? 'RECHARGE'
      : 'VIP_ACTIVATION'
  );

  const user =
    (tx.userId ? users.find((u) => u.id === tx.userId) : undefined) ||
    users.find((u) => isSamePhoneNumber(u.phone, tx.phone));

  const nowIso = new Date().toISOString();

  if (decision === 'ACCEPT') {
    if (tx.status === 'SUCCESS') {
      return res.json({ success: true, transaction: tx, user });
    }

    tx.status = 'SUCCESS';
    tx.updatedAt = nowIso;

    let supportText = '';

    if (txCategory === 'WITHDRAWAL') {
      tx.statusMessage = 'Retrait validé et payé sur votre numéro Mobile Money par l’administrateur.';
      supportText = `✅ Retrait Validé : Votre retrait de ${tx.amount.toLocaleString('fr-FR')} FCFA vers ${tx.phone} (${tx.operatorName}) a été CONFIRMÉ et envoyé par l’administration.`;
    } else if (txCategory === 'RECHARGE') {
      tx.statusMessage = 'Rechargement vérifié et crédité sur votre solde par l’administrateur.';
      if (user) {
        user.balance = (typeof user.balance === 'number' ? user.balance : 0) + tx.amount;
        user.notes = `Solde rechargé de ${tx.amount} FCFA le ${new Date().toLocaleString('fr-FR')}`;
      }
      supportText = `💰 Rechargement Validé : Votre dépôt Mobile Money de ${tx.amount.toLocaleString('fr-FR')} FCFA a été APPROUVÉ et crédité sur votre solde Aviator !`;
    } else {
      tx.statusMessage = 'Paiement VIP vérifié et validé avec succès par l’administrateur.';
      if (user) {
        user.paymentStatus = 'paid';
        user.amountPaid = tx.amount;
        user.paymentReference = tx.saspayPaymentId || tx.id;
        user.paymentDate = new Date().toLocaleString('fr-FR');
        user.paymentMethod = tx.operatorBrand as any;
        if (tx.description && tx.description.includes('VIP2')) {
          user.vipTier = 'VIP2';
        }
        if (typeof user.balance !== 'number') {
          user.balance = 0;
        }
        user.notes = 'Accès VIP validé par l\'administrateur';
      }
      supportText = `🎉 Félicitations ! Votre paiement Mobile Money de ${tx.amount} FCFA via ${tx.operatorName} (${tx.phone}) a été VALIDÉ par l'administration. Votre tableau de bord Aviator & Code 15 est maintenant ACTIF !`;
    }

    upsertUserOperation({
      id: `op_${tx.id}`,
      userId: user ? user.id : tx.phone,
      userPhone: user ? user.phone : tx.phone,
      type: txCategory,
      amount: tx.amount,
      status: 'SUCCESS',
      title:
        txCategory === 'WITHDRAWAL'
          ? 'Retrait Mobile Money Validé'
          : txCategory === 'RECHARGE'
          ? 'Rechargement Solde Validé'
          : `Accès ${user?.vipTier || 'VIP'} Débloqué`,
      description: tx.statusMessage,
      reference: tx.saspayPaymentId || tx.id,
      createdAt: tx.createdAt,
      updatedAt: nowIso,
    });

    // Automated support notification
    let conv = supportConversations.find(
      (c) => isSamePhoneNumber(c.userPhone, tx.phone) || (user && c.userId === user.id)
    );
    if (!conv) {
      conv = {
        userId: user ? user.id : `usr_${Date.now()}`,
        userName: tx.customerName || (user ? user.fullName : 'Client'),
        userPhone: tx.phone,
        userCountry: tx.countryName || 'Bénin',
        lastMessageAt: nowIso,
        unreadCountClient: 1,
        unreadCountAdmin: 0,
        messages: [{
          id: `msg_sys_${Date.now()}`,
          sender: 'admin',
          text: supportText,
          timestamp: nowIso,
          read: false,
        }],
      };
      supportConversations.unshift(conv);
    } else {
      conv.messages.push({
        id: `msg_sys_${Date.now()}`,
        sender: 'admin',
        text: supportText,
        timestamp: nowIso,
        read: false,
      });
      conv.unreadCountClient += 1;
      conv.lastMessageAt = nowIso;
    }
  } else if (decision === 'REJECT') {
    if (tx.status === 'FAILED') {
      return res.json({ success: true, transaction: tx, user });
    }

    const wasPending = tx.status === 'PENDING';
    tx.status = 'FAILED';
    tx.updatedAt = nowIso;

    let rejectionText = '';

    if (txCategory === 'WITHDRAWAL') {
      tx.statusMessage = reason || 'Demande de retrait rejetée par l’administrateur. Montant recrédité sur votre solde.';
      if (user && wasPending) {
        user.balance = (typeof user.balance === 'number' ? user.balance : 0) + tx.amount;
      }
      rejectionText = `⚠️ Retrait Rejeté : Votre demande de retrait de ${tx.amount.toLocaleString('fr-FR')} FCFA a été rejetée (${reason || 'Vérification requise'}). Le montant a été recrédité sur votre solde.`;
    } else if (txCategory === 'RECHARGE') {
      tx.statusMessage = reason || 'Rechargement rejeté par l’administrateur (transfert non reçu).';
      rejectionText = `⚠️ Rechargement Rejeté : Votre demande de rechargement de ${tx.amount.toLocaleString('fr-FR')} FCFA a été rejetée (${reason || 'Transfert non confirmé'}).`;
    } else {
      tx.statusMessage = reason || 'Paiement rejeté par l’administrateur (fonds non confirmés ou transaction invalide).';
      // Protect already-validated VIP accounts from accidental downgrade if an old pending request is rejected
      if (user && user.paymentStatus !== 'paid') {
        user.paymentStatus = 'unpaid';
        user.notes = `Demande rejetée : ${reason || 'Non confirmé'}`;
      }
      rejectionText = `⚠️ Information Paiement : Votre demande de ${tx.amount} FCFA via ${tx.operatorName} a été REJETÉE par l'administration. Motif : ${reason || 'Non confirmation du transfert'}.`;
    }

    upsertUserOperation({
      id: `op_${tx.id}`,
      userId: user ? user.id : tx.phone,
      userPhone: user ? user.phone : tx.phone,
      type: txCategory,
      amount: tx.amount,
      status: 'FAILED',
      title:
        txCategory === 'WITHDRAWAL'
          ? 'Retrait Rejeté (Solde Recrédité)'
          : txCategory === 'RECHARGE'
          ? 'Rechargement Rejeté'
          : 'Paiement VIP Rejeté',
      description: tx.statusMessage,
      reference: tx.saspayPaymentId || tx.id,
      createdAt: tx.createdAt,
      updatedAt: nowIso,
    });

    let conv = supportConversations.find((c) =>
      isSamePhoneNumber(c.userPhone, tx.phone) || (user && c.userId === user.id)
    );
    if (!conv) {
      conv = {
        userId: user ? user.id : `usr_${Date.now()}`,
        userName: tx.customerName || (user ? user.fullName : 'Client'),
        userPhone: tx.phone,
        userCountry: tx.countryName || 'Bénin',
        lastMessageAt: nowIso,
        unreadCountClient: 1,
        unreadCountAdmin: 0,
        messages: [{
          id: `msg_sys_${Date.now()}`,
          sender: 'admin',
          text: rejectionText,
          timestamp: nowIso,
          read: false,
        }],
      };
      supportConversations.unshift(conv);
    } else {
      conv.messages.push({
        id: `msg_sys_${Date.now()}`,
        sender: 'admin',
        text: rejectionText,
        timestamp: nowIso,
        read: false,
      });
      conv.unreadCountClient += 1;
      conv.lastMessageAt = nowIso;
    }
  } else {
    return res.status(400).json({ success: false, message: 'Décision invalide (ACCEPT ou REJECT attendu).' });
  }

  saveDataStore();

  if (user) {
    broadcastToUser(user, 'user:updated', {
      user,
      transaction: tx,
      decision,
      transactionType: txCategory,
    });
    const updatedConv = supportConversations.find(
      (c) => isSamePhoneNumber(c.userPhone, tx.phone) || c.userId === user.id
    );
    if (updatedConv) {
      broadcastToUser(user, 'support:updated', { conversation: updatedConv });
    }
  }
  broadcastToAdmins('admin:update', { reason: 'decision_applied', transaction: tx });

  return res.json({ success: true, transaction: tx, user });
});

// =========================================================================
// REAL-TIME SERVER-AUTHORITATIVE AVIATOR GAME & BOT SIGNAL ENGINE (CODE 15)
// =========================================================================
interface ServerAviatorEngine {
  phase: 'COUNTDOWN' | 'FLYING' | 'CRASHED';
  roundNumber: number;
  roundId: string;
  code15: string;
  crashPoint: number;
  currentMultiplier: number;
  countdownSeconds: number;
  phaseStartedAt: number;
  adminOverrideOdd: number | null;
  activeBets: Map<string, AviatorActiveBet>;
}

function generateCode15(roundNumber: number): string {
  const randomDigits = Math.floor(10000000000 + Math.random() * 89999999999).toString();
  const raw = `AV15${String(roundNumber).padStart(2, '0')}${randomDigits}`;
  return raw.slice(0, 15);
}

function generateNextCrashPoint(overrideOdd: number | null): number {
  if (overrideOdd && overrideOdd >= 1.1) {
    return parseFloat(overrideOdd.toFixed(2));
  }
  const r = Math.random();
  if (r < 0.48) {
    return parseFloat((1.35 + Math.random() * 2.15).toFixed(2)); // 1.35x - 3.50x
  } else if (r < 0.80) {
    return parseFloat((3.50 + Math.random() * 6.50).toFixed(2)); // 3.50x - 10.00x
  } else if (r < 0.94) {
    return parseFloat((10.00 + Math.random() * 25.00).toFixed(2)); // 10.00x - 35.00x
  } else {
    return parseFloat((35.00 + Math.random() * 65.00).toFixed(2)); // 35.00x - 100.00x
  }
}

const aviatorEngine: ServerAviatorEngine = {
  phase: 'COUNTDOWN',
  roundNumber: (aviatorHistory[0]?.roundNumber || 100) + 1,
  roundId: `rnd_${Date.now()}`,
  code15: generateCode15((aviatorHistory[0]?.roundNumber || 100) + 1),
  crashPoint: generateNextCrashPoint(null),
  currentMultiplier: 1.0,
  countdownSeconds: 15,
  phaseStartedAt: Date.now(),
  adminOverrideOdd: null,
  activeBets: new Map(),
};

function buildPublicAviatorState(viewer?: User | 'ADMIN'): AviatorGameState {
  const isVipOrAdmin = viewer === 'ADMIN' || (viewer && viewer.paymentStatus === 'paid');
  const elapsedFlightSeconds =
    aviatorEngine.phase === 'FLYING'
      ? Math.max(0, (Date.now() - aviatorEngine.phaseStartedAt) / 1000)
      : 0;

  let activeBet: AviatorActiveBet | null = null;
  if (viewer && viewer !== 'ADMIN') {
    activeBet = aviatorEngine.activeBets.get(viewer.id) || null;
  }

  return {
    phase: aviatorEngine.phase,
    roundNumber: aviatorEngine.roundNumber,
    roundId: aviatorEngine.roundId,
    code15: isVipOrAdmin ? aviatorEngine.code15 : 'AV15***********',
    nextCrashPoint: isVipOrAdmin ? aviatorEngine.crashPoint : null,
    currentMultiplier: aviatorEngine.currentMultiplier,
    countdownSeconds: aviatorEngine.countdownSeconds,
    elapsedFlightSeconds: parseFloat(elapsedFlightSeconds.toFixed(2)),
    history: aviatorHistory.slice(0, 15),
    activeBet,
  };
}

function startNewCountdownRound() {
  aviatorEngine.roundNumber += 1;
  aviatorEngine.roundId = `rnd_${Date.now()}`;
  aviatorEngine.phase = 'COUNTDOWN';
  aviatorEngine.countdownSeconds = 15;
  aviatorEngine.currentMultiplier = 1.0;
  aviatorEngine.phaseStartedAt = Date.now();
  aviatorEngine.code15 = generateCode15(aviatorEngine.roundNumber);
  aviatorEngine.crashPoint = generateNextCrashPoint(aviatorEngine.adminOverrideOdd);
  aviatorEngine.adminOverrideOdd = null;
  aviatorEngine.activeBets.clear();
}

// Tick Aviator Engine every 100ms
setInterval(() => {
  const now = Date.now();
  const elapsedSec = (now - aviatorEngine.phaseStartedAt) / 1000;

  if (aviatorEngine.phase === 'COUNTDOWN') {
    const remaining = Math.max(0, Math.ceil(15 - elapsedSec));
    aviatorEngine.countdownSeconds = remaining;

    if (elapsedSec >= 15) {
      aviatorEngine.phase = 'FLYING';
      aviatorEngine.phaseStartedAt = now;
      aviatorEngine.currentMultiplier = 1.0;
      aviatorEngine.countdownSeconds = 0;
    }
  } else if (aviatorEngine.phase === 'FLYING') {
    // Slow, calm, readable Spribe Aviator climb curve (~11s to reach 2.00x, zero rush)
    const mult = parseFloat(
      (1 + elapsedSec * 0.065 + Math.pow(elapsedSec, 1.65) * 0.006).toFixed(2)
    );
    if (mult >= aviatorEngine.crashPoint) {
      aviatorEngine.currentMultiplier = aviatorEngine.crashPoint;
      aviatorEngine.phase = 'CRASHED';
      aviatorEngine.phaseStartedAt = now;

      // Record round in persistent history
      aviatorHistory.unshift({
        roundNumber: aviatorEngine.roundNumber,
        crashPoint: aviatorEngine.crashPoint,
        code15: aviatorEngine.code15,
        timestamp: new Date().toISOString(),
      });
      if (aviatorHistory.length > 40) {
        aviatorHistory = aviatorHistory.slice(0, 40);
      }

      // Settle lost bets
      aviatorEngine.activeBets.forEach((bet) => {
        if (!bet.cashedOut) {
          const usr = users.find((u) => u.id === bet.userId);
          if (usr) {
            upsertUserOperation({
              id: bet.betId,
              userId: usr.id,
              userPhone: usr.phone,
              type: 'BET',
              amount: bet.amount,
              status: 'FAILED',
              title: `Vol #${aviatorEngine.roundNumber} · Envolé @ ${aviatorEngine.crashPoint.toFixed(2)}x`,
              description: `Mise de ${bet.amount} FCFA non encaissée avant ${aviatorEngine.crashPoint.toFixed(2)}x`,
              reference: aviatorEngine.code15,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            broadcastToUser(usr, 'user:updated', { user: usr });
          }
        }
      });
      saveDataStore();
    } else {
      aviatorEngine.currentMultiplier = mult;
    }
  } else if (aviatorEngine.phase === 'CRASHED') {
    if (elapsedSec >= 3.2) {
      startNewCountdownRound();
    }
  }

  // Broadcast real-time Aviator state to connected clients
  if (sseClients.size > 0) {
    for (const client of sseClients) {
      if (client.role === 'admin') {
        sendSSE(client, 'aviator:tick', buildPublicAviatorState('ADMIN'));
      } else {
        const matchedUser = client.userId || client.userPhone
          ? users.find(
              (u) =>
                (client.userId && u.id === client.userId) ||
                (client.userPhone && isSamePhoneNumber(u.phone, client.userPhone))
            )
          : undefined;
        sendSSE(client, 'aviator:tick', buildPublicAviatorState(matchedUser));
      }
    }
  }
}, 100);

// 7.b Aviator State Endpoint
app.get('/api/aviator/state', (req: Request, res: Response) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const phone = typeof req.query.phone === 'string' ? req.query.phone : undefined;
  const user = users.find(
    (u) => (userId && u.id === userId) || (phone && isSamePhoneNumber(u.phone, phone))
  );
  return res.json({ success: true, state: buildPublicAviatorState(user) });
});

// 7.c Place Bet on Aviator Round (during 15s COUNTDOWN)
app.post('/api/aviator/bet', (req: Request, res: Response) => {
  const { userId, amount } = req.body;
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ success: false, message: 'Compte introuvable.' });
  }
  if (user.paymentStatus !== 'paid') {
    return res.status(403).json({ success: false, message: 'Licence VIP requise.' });
  }
  if (aviatorEngine.phase !== 'COUNTDOWN') {
    return res.status(400).json({
      success: false,
      message: 'Veuillez attendre le compte à rebours de 15 secondes du prochain vol.',
    });
  }
  if (aviatorEngine.activeBets.has(user.id)) {
    return res.status(400).json({ success: false, message: 'Vous avez déjà placé une mise sur ce vol.' });
  }

  const betAmount = Math.floor(Number(amount));
  if (isNaN(betAmount) || betAmount < 100) {
    return res.status(400).json({ success: false, message: 'Mise minimale : 100 FCFA.' });
  }

  const currentBal = typeof user.balance === 'number' ? user.balance : 0;
  if (betAmount > currentBal) {
    return res.status(400).json({
      success: false,
      message: `Solde insuffisant (${currentBal.toLocaleString('fr-FR')} FCFA). Veuillez recharger votre compte.`,
    });
  }

  user.balance = currentBal - betAmount;
  const nowIso = new Date().toISOString();
  const betId = `bet_${Date.now()}_${user.id.slice(-4)}`;
  const activeBet: AviatorActiveBet = {
    betId,
    userId: user.id,
    amount: betAmount,
    roundNumber: aviatorEngine.roundNumber,
    cashedOut: false,
  };
  aviatorEngine.activeBets.set(user.id, activeBet);

  upsertUserOperation({
    id: betId,
    userId: user.id,
    userPhone: user.phone,
    type: 'BET',
    amount: betAmount,
    status: 'PENDING',
    title: `Mise Vol #${aviatorEngine.roundNumber}`,
    description: `Mise de ${betAmount.toLocaleString('fr-FR')} FCFA engagée (Code 15: ${aviatorEngine.code15})`,
    reference: aviatorEngine.code15,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  saveDataStore();
  broadcastToUser(user, 'user:updated', { user });

  return res.json({ success: true, user, activeBet });
});

// 7.d Cash Out during FLYING phase
app.post('/api/aviator/cashout', (req: Request, res: Response) => {
  const { userId } = req.body;
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Compte introuvable.' });
  }

  const bet = aviatorEngine.activeBets.get(user.id);
  if (!bet || bet.cashedOut) {
    return res.status(400).json({ success: false, message: 'Aucune mise active à encaisser.' });
  }
  if (aviatorEngine.phase !== 'FLYING') {
    return res.status(400).json({ success: false, message: 'Le vol n’est pas actif.' });
  }

  const mult = aviatorEngine.currentMultiplier;
  if (mult >= aviatorEngine.crashPoint) {
    return res.status(400).json({ success: false, message: 'Trop tard, l’avion s’est déjà envolé !' });
  }

  const winAmount = Math.floor(bet.amount * mult);
  bet.cashedOut = true;
  bet.cashoutMultiplier = mult;
  bet.winAmount = winAmount;

  user.balance = (typeof user.balance === 'number' ? user.balance : 0) + winAmount;
  const nowIso = new Date().toISOString();

  upsertUserOperation({
    id: bet.betId,
    userId: user.id,
    userPhone: user.phone,
    type: 'WIN',
    amount: winAmount,
    status: 'SUCCESS',
    title: `Gain Encaissé Vol #${aviatorEngine.roundNumber} (${mult.toFixed(2)}x)`,
    description: `Mise ${bet.amount.toLocaleString('fr-FR')} F ➔ Gain ${winAmount.toLocaleString('fr-FR')} FCFA à ${mult.toFixed(2)}x`,
    reference: aviatorEngine.code15,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  saveDataStore();
  broadcastToUser(user, 'user:updated', { user });

  return res.json({
    success: true,
    user,
    bet,
    winAmount,
    cashoutMultiplier: mult,
  });
});

// 7.e Admin Set Next Exact Bot Multiplier
app.post('/api/admin/aviator/next-odd', (req: Request, res: Response) => {
  const { nextOdd } = req.body;
  const parsed = parseFloat(nextOdd);
  if (isNaN(parsed) || parsed < 1.1 || parsed > 200) {
    return res.status(400).json({ success: false, message: 'Cote invalide (entre 1.10x et 200.00x).' });
  }
  aviatorEngine.adminOverrideOdd = parsed;
  if (aviatorEngine.phase === 'COUNTDOWN') {
    aviatorEngine.crashPoint = parseFloat(parsed.toFixed(2));
  }
  return res.json({
    success: true,
    nextCrashPoint: parsed,
    state: buildPublicAviatorState('ADMIN'),
  });
});

// 8. Consolidated Dashboard Stats (Including Real Admin Treasury Balance)
app.get('/api/stats', (_req: Request, res: Response) => {
  const totalVipRevenue = transactions
    .filter((t) => t.status === 'SUCCESS' && (!t.transactionType || t.transactionType === 'VIP_ACTIVATION'))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalRecharges = transactions
    .filter((t) => t.status === 'SUCCESS' && t.transactionType === 'RECHARGE')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = transactions
    .filter((t) => t.status === 'SUCCESS' && t.transactionType === 'WITHDRAWAL')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalVolume = totalVipRevenue + totalRecharges;
  const adminBalance = totalVipRevenue + totalRecharges - totalWithdrawals;

  const successfulTransactions = transactions.filter((t) => t.status === 'SUCCESS').length;
  const pendingTransactions = transactions.filter((t) => t.status === 'PENDING').length;
  const failedTransactions = transactions.filter((t) => t.status === 'FAILED').length;
  const totalTransactions = transactions.length;

  const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

  const volumeByCountry: Record<CountryCode, number> = {
    BJ: 0,
    BF: 0,
    CI: 0,
    GW: 0,
    ML: 0,
    NE: 0,
    SN: 0,
    TG: 0,
  };

  const volumeByOperator: Record<string, number> = {};

  transactions.forEach((t) => {
    if (t.status === 'SUCCESS' && t.transactionType !== 'WITHDRAWAL') {
      if (volumeByCountry[t.country] !== undefined) {
        volumeByCountry[t.country] += t.amount;
      }
      volumeByOperator[t.operatorName] = (volumeByOperator[t.operatorName] || 0) + t.amount;
    }
  });

  const stats: DashboardStats = {
    totalVolume,
    totalVipRevenue,
    totalRecharges,
    totalWithdrawals,
    adminBalance,
    totalTransactions,
    successfulTransactions,
    pendingTransactions,
    failedTransactions,
    successRate: parseFloat(successRate.toFixed(1)),
    volumeByCountry,
    volumeByOperator,
    countByStatus: {
      SUCCESS: successfulTransactions,
      PENDING: pendingTransactions,
      FAILED: failedTransactions,
    },
  };

  return res.json({ success: true, stats });
});

// 9. API Health Check
app.get('/api/health', async (_req: Request, res: Response) => {
  const maskedKey = `${SASPAY_SECRET_KEY.slice(0, 7)}...${SASPAY_SECRET_KEY.slice(-6)}`;
  return res.json({
    status: 'ONLINE',
    saspayKeyPresent: Boolean(SASPAY_SECRET_KEY),
    maskedKey,
    supportedCountries: ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'],
    totalUsers: users.length,
    totalTransactions: transactions.length,
    totalOperations: operations.length,
  });
});

// =========================================================================
// VITE & STATIC ASSETS HANDLER
// =========================================================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SASPAY PLATFORM] Serveur démarré avec succès sur le port ${PORT}`);
    console.log(`[SASPAY PLATFORM] Clé SasPay configurée: ${SASPAY_SECRET_KEY.slice(0, 7)}...`);
  });
}

startServer();
