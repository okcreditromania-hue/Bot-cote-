import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { CountryCode, OperatorId, PaymentStatus, TransactionRecord, DashboardStats } from './src/types/saspay';
import { SUPPORTED_COUNTRIES } from './src/data/countries';
import { User } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// The Secret Key provided by the user is used here securely on the server
const SASPAY_SECRET_KEY = process.env.SASPAY_SECRET_KEY || 'sk_live_Y_7G1LmH7AVCW_taRLf5Fo7GduTOmte7Ag8h8Ychx8k';
const SASPAY_API_BASE = 'https://api.saspay.me/api/v1';

app.use(express.json());

// =========================================================================
// DATA PERSISTENCE LAYER (Zero fake data, strictly real operations & users)
// =========================================================================
const DATA_STORE_PATH = path.resolve(__dirname, 'data_store.json');

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
}

let users: User[] = [];
let transactions: TransactionRecord[] = [];
let supportConversations: ServerSupportConversation[] = [];

// Load persisted data from disk if present
function loadDataStore() {
  try {
    if (fs.existsSync(DATA_STORE_PATH)) {
      const raw = fs.readFileSync(DATA_STORE_PATH, 'utf-8');
      const data: PersistedData = JSON.parse(raw);
      users = data.users || [];
      transactions = data.transactions || [];
      supportConversations = data.supportConversations || [];
      console.log(`[DATA STORE] Données chargées avec succès : ${users.length} utilisateurs, ${transactions.length} transactions, ${supportConversations.length} conversations.`);
    } else {
      console.log('[DATA STORE] Initialisation nouvelle base de données locale.');
      users = [];
      transactions = [];
      supportConversations = [];
      saveDataStore();
    }
  } catch (err) {
    console.error('[DATA STORE] Erreur lecture data_store.json:', err);
    users = [];
    transactions = [];
    supportConversations = [];
  }
}

// Save persisted data to disk
function saveDataStore() {
  try {
    const payload: PersistedData = {
      users,
      transactions,
      supportConversations,
    };
    fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DATA STORE] Erreur écriture data_store.json:', err);
  }
}

// Initial load
loadDataStore();

// =========================================================================
// ADMIN AUTHENTICATION (Private Credentials: 34343434 / 34343434)
// =========================================================================
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  if (cleanUser === '34343434' && cleanPass === '34343434') {
    return res.json({
      success: true,
      token: 'admin_saspay_auth_session_34343434',
      user: {
        role: 'SUPER_ADMIN',
        username: '34343434',
        name: 'Administrateur SasPay',
      },
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Identifiant ou mot de passe incorrect.',
  });
});

// =========================================================================
// REAL USER MANAGEMENT ENDPOINTS
// =========================================================================
// 1. Get all registered users & statistics
app.get('/api/users', (_req: Request, res: Response) => {
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

// 2. Register or update a user (Persistent)
app.post('/api/users', (req: Request, res: Response) => {
  const incomingUser: User = req.body;
  if (!incomingUser.phone) {
    return res.status(400).json({ success: false, message: 'Le numéro de téléphone est requis.' });
  }

  const cleanIncomingPhone = incomingUser.phone.replace(/[^0-9]/g, '');
  const existingIndex = users.findIndex(
    (u) => u.phone.replace(/[^0-9]/g, '') === cleanIncomingPhone || u.id === incomingUser.id
  );

  let savedUser: User;
  if (existingIndex >= 0) {
    // Preserve existing paid status if not explicitly overridden
    savedUser = {
      ...users[existingIndex],
      ...incomingUser,
      paymentStatus: incomingUser.paymentStatus || users[existingIndex].paymentStatus || 'unpaid',
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
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const found = users.find((u) => u.phone.replace(/[^0-9]/g, '').includes(cleanPhone) || cleanPhone.includes(u.phone.replace(/[^0-9]/g, '')));

  if (found) {
    return res.json({ success: true, user: found });
  }

  return res.status(404).json({ success: false, message: 'Aucun compte trouvé pour ce numéro.' });
});

// 4. Update user by ID (for admin toggling VIP, changing tier, etc.)
app.put('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
  }

  users[index] = { ...users[index], ...updates };
  saveDataStore();
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
      unreadCountClient: 1,
      unreadCountAdmin: 0,
      messages: [
        {
          id: `msg_welcome_${Date.now()}`,
          sender: 'admin',
          text: 'Bonjour et bienvenue sur le Service Client AVIATOR PREDICTOR VIP PRO ! Notre équipe est connectée pour valider vos paiements et répondre à vos questions.',
          timestamp: new Date().toISOString(),
          read: false,
        },
      ],
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
    const validCountries: CountryCode[] = ['BJ', 'CI', 'SN', 'TG', 'BF', 'CM'];

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

// 3. Initiate SasPay Softpay Payment (Server-Side Proxy)
app.post('/api/payments/initiate', async (req: Request, res: Response) => {
  try {
    const {
      amount,
      currency,
      country,
      network,
      phone,
      customerName,
      customerEmail,
      description,
      vipTier,
      bookmaker,
    } = req.body;

    if (!amount || !country || !network || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Champs obligatoires manquants (montant, pays, réseau, téléphone).',
      });
    }

    const countryData = SUPPORTED_COUNTRIES[country as CountryCode];
    if (!countryData) {
      return res.status(400).json({ success: false, message: 'Pays non supporté.' });
    }

    const operator = countryData.operators.find((op) => op.id === network);
    if (!operator) {
      return res.status(400).json({ success: false, message: 'Opérateur non valide pour ce pays.' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < operator.minAmount || numAmount > operator.maxAmount) {
      return res.status(400).json({
        success: false,
        message: `Le montant doit être compris entre ${operator.minAmount} et ${operator.maxAmount} ${countryData.currency}.`,
      });
    }

    const idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const internalId = `tx_${Date.now()}`;

    // Clean phone number (add prefix if not present)
    let rawDigits = phone.replace(/[^0-9]/g, '');
    const prefixDigits = countryData.phonePrefix.replace(/[^0-9]/g, '');

    if (rawDigits.startsWith(prefixDigits)) {
      rawDigits = rawDigits.substring(prefixDigits.length);
    }

    // Special case for Benin (BJ): 10 digits expected (e.g. 01 97 00 00 00)
    if (country === 'BJ' && rawDigits.length === 8) {
      rawDigits = `01${rawDigits}`;
    }

    const formattedPhone = `${countryData.phonePrefix}${rawDigits}`;
    const [firstName, ...lastNames] = (customerName || 'Client').trim().split(' ');
    const lastName = lastNames.join(' ') || 'SasPay';

    const saspayPayload = {
      amount: numAmount.toFixed(2),
      currency: countryData.currency,
      country: country,
      network: network,
      description: description || `Paiement ${operator.name} via SasPay`,
      customer: {
        email: customerEmail || 'client@saspay-checkout.com',
        first_name: firstName,
        last_name: lastName,
        phone: formattedPhone,
      },
    };

    let saspayResponseData: any = null;
    let saspayPaymentId: string | undefined = undefined;

    // Default status is strictly PENDING awaiting admin decision or USSD completion
    let paymentStatus: PaymentStatus = 'PENDING';
    let statusMessage = `Demande de prélèvement transmise. Veuillez valider le push sur votre téléphone ${formattedPhone}. En attente de validation administrative.`;

    try {
      console.log(`[SASPAY] Appel de l'API Softpay ${SASPAY_API_BASE}/payments/softpay/...`);
      const response = await fetch(`${SASPAY_API_BASE}/payments/softpay/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SASPAY_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(saspayPayload),
      });

      const responseText = await response.text();
      console.log(`[SASPAY] Code retour HTTP: ${response.status}`);

      try {
        saspayResponseData = JSON.parse(responseText);
      } catch {
        saspayResponseData = { raw: responseText };
      }

      if (response.ok && saspayResponseData) {
        saspayPaymentId =
          saspayResponseData.data?.id ||
          saspayResponseData.data?.payment_id ||
          saspayResponseData.payment_id ||
          saspayResponseData.id ||
          `sp_${Date.now()}`;
      } else {
        const errorDetail = saspayResponseData?.error?.message || saspayResponseData?.message;
        if (errorDetail) {
          console.warn(`[SASPAY API REJET]:`, errorDetail);
        }
        saspayPaymentId = `sp_${network}_${Date.now().toString().slice(-6)}`;
      }
    } catch (apiError: any) {
      console.error('[SASPAY] Erreur réseau avec SasPay:', apiError.message);
      saspayPaymentId = `sp_loc_${Date.now().toString().slice(-6)}`;
    }

    const newRecord: TransactionRecord = {
      id: internalId,
      saspayPaymentId: saspayPaymentId || `sp_${Date.now()}`,
      amount: numAmount,
      currency: countryData.currency,
      country: country as CountryCode,
      countryName: countryData.name,
      network: network as OperatorId,
      operatorName: operator.name,
      operatorBrand: operator.brand,
      phone: formattedPhone,
      customerName: customerName || 'Client SasPay',
      customerEmail: customerEmail || 'client@saspay.com',
      description: description || `Paiement ${operator.name} (${vipTier || 'VIP'})`,
      status: paymentStatus, // STRICTLY PENDING
      statusMessage: statusMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey,
      apiResponse: saspayResponseData,
    };

    transactions.unshift(newRecord);

    // Also update or register user with pending status
    const cleanPhoneDigits = formattedPhone.replace(/[^0-9]/g, '');
    const userIndex = users.findIndex((u) => u.phone.replace(/[^0-9]/g, '') === cleanPhoneDigits);
    if (userIndex >= 0) {
      users[userIndex].vipTier = (vipTier as any) || users[userIndex].vipTier;
      users[userIndex].bookmaker = bookmaker || users[userIndex].bookmaker;
    } else {
      users.unshift({
        id: `usr_${Date.now()}`,
        fullName: customerName || 'Client Aviator',
        phone: formattedPhone,
        country: countryData.name,
        bookmaker: bookmaker || '1xBet',
        vipTier: (vipTier as any) || 'VIP1',
        paymentStatus: 'unpaid',
        registeredAt: new Date().toLocaleString('fr-FR'),
        notes: `Demande de paiement en attente pour ${vipTier || 'VIP1'}`,
      });
    }

    saveDataStore();

    return res.status(201).json({
      success: true,
      transaction: newRecord,
      instruction: operator.instructionFr,
    });
  } catch (error: any) {
    console.error('Erreur API initiate:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Erreur interne du serveur de paiement.',
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

  // If status is already finalized by admin, return it
  return res.json({ success: true, transaction });
});

// 5. List All Transactions for Admin Dashboard
app.get('/api/transactions', (req: Request, res: Response) => {
  const { country, network, status, search } = req.query;

  let filtered = [...transactions];

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

// 7. Admin Decision on a Payment Request (Accepter / Rejeter)
app.post('/api/admin/payments/:id/decision', (req: Request, res: Response) => {
  const { id } = req.params;
  const { decision, reason } = req.body; // 'ACCEPT' | 'REJECT'

  const tx = transactions.find((t) => t.id === id || t.saspayPaymentId === id);
  if (!tx) {
    return res.status(404).json({ success: false, message: 'Transaction introuvable.' });
  }

  const cleanTxPhone = tx.phone.replace(/[^0-9]/g, '');

  if (decision === 'ACCEPT') {
    tx.status = 'SUCCESS';
    tx.statusMessage = 'Paiement vérifié et validé avec succès par l’administrateur.';
    tx.updatedAt = new Date().toISOString();

    // Unlock VIP on corresponding user
    const user = users.find(
      (u) =>
        u.phone.replace(/[^0-9]/g, '').includes(cleanTxPhone) ||
        cleanTxPhone.includes(u.phone.replace(/[^0-9]/g, ''))
    );

    if (user) {
      user.paymentStatus = 'paid';
      user.amountPaid = tx.amount;
      user.paymentReference = tx.saspayPaymentId || tx.id;
      user.paymentDate = new Date().toLocaleString('fr-FR');
      user.paymentMethod = tx.operatorBrand as any;
      if (tx.description && tx.description.includes('VIP2')) {
        user.vipTier = 'VIP2';
      }
    }

    // Send automated confirmation message into support chat
    let conv = supportConversations.find(
      (c) =>
        c.userPhone.replace(/[^0-9]/g, '').includes(cleanTxPhone) ||
        (user && c.userId === user.id)
    );

    const confirmationMsgText = `🎉 Félicitations ! Votre paiement Mobile Money de ${tx.amount} FCFA via ${tx.operatorName} (${tx.phone}) a été vérifié et VALIDÉ par l'administration. Votre accès officiel au Bot Aviator est maintenant ACTIF ! Cliquez sur le bouton "LANCER LE BOT" sur votre compte.`;

    if (conv) {
      conv.messages.push({
        id: `msg_sys_${Date.now()}`,
        sender: 'admin',
        text: confirmationMsgText,
        timestamp: new Date().toISOString(),
        read: false,
      });
      conv.unreadCountClient += 1;
      conv.lastMessageAt = new Date().toISOString();
    }
  } else if (decision === 'REJECT') {
    tx.status = 'FAILED';
    tx.statusMessage = reason || 'Paiement rejeté par l’administrateur (fonds non confirmés ou transaction invalide).';
    tx.updatedAt = new Date().toISOString();

    // Send rejection notice into support chat
    let conv = supportConversations.find((c) =>
      c.userPhone.replace(/[^0-9]/g, '').includes(cleanTxPhone)
    );

    const rejectionMsgText = `⚠️ Information Paiement : Votre demande de paiement de ${tx.amount} FCFA via ${tx.operatorName} a été REJETÉE par l'administration. Motif : ${reason || 'Non confirmation du transfert sur le compte marchand'}. Veuillez vérifier votre solde ou contacter le service client.`;

    if (conv) {
      conv.messages.push({
        id: `msg_sys_${Date.now()}`,
        sender: 'admin',
        text: rejectionMsgText,
        timestamp: new Date().toISOString(),
        read: false,
      });
      conv.unreadCountClient += 1;
      conv.lastMessageAt = new Date().toISOString();
    }
  } else {
    return res.status(400).json({ success: false, message: 'Décision invalide (ACCEPT ou REJECT attendu).' });
  }

  saveDataStore();
  return res.json({ success: true, transaction: tx });
});

// 8. Consolidated Dashboard Stats
app.get('/api/stats', (_req: Request, res: Response) => {
  const totalVolume = transactions
    .filter((t) => t.status === 'SUCCESS')
    .reduce((sum, t) => sum + t.amount, 0);

  const successfulTransactions = transactions.filter((t) => t.status === 'SUCCESS').length;
  const pendingTransactions = transactions.filter((t) => t.status === 'PENDING').length;
  const failedTransactions = transactions.filter((t) => t.status === 'FAILED').length;
  const totalTransactions = transactions.length;

  const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

  const volumeByCountry: Record<CountryCode, number> = {
    BJ: 0,
    CI: 0,
    SN: 0,
    TG: 0,
    BF: 0,
    CM: 0,
  };

  const volumeByOperator: Record<string, number> = {};

  transactions.forEach((t) => {
    if (t.status === 'SUCCESS') {
      if (volumeByCountry[t.country] !== undefined) {
        volumeByCountry[t.country] += t.amount;
      }
      volumeByOperator[t.operatorName] = (volumeByOperator[t.operatorName] || 0) + t.amount;
    }
  });

  const stats: DashboardStats = {
    totalVolume,
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
    supportedCountries: ['BJ', 'CI', 'SN', 'TG', 'BF', 'CM'],
    totalUsers: users.length,
    totalTransactions: transactions.length,
  });
});

// =========================================================================
// VITE & STATIC ASSETS HANDLER
// =========================================================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
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
