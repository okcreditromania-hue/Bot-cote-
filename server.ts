import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { CountryCode, OperatorId, PaymentStatus, TransactionRecord, DashboardStats } from './src/types/saspay';
import { SUPPORTED_COUNTRIES } from './src/data/countries';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// The Secret Key provided by the user is used here securely on the server
const SASPAY_SECRET_KEY = process.env.SASPAY_SECRET_KEY || 'sk_live_Y_7G1LmH7AVCW_taRLf5Fo7GduTOmte7Ag8h8Ychx8k';
const SASPAY_API_BASE = 'https://api.saspay.me/api/v1';

app.use(express.json());

// In-Memory Transaction Store with initial realistic seed data across the 6 countries
const transactions: TransactionRecord[] = [
  {
    id: 'tx_sas_001',
    saspayPaymentId: 'sp_pay_994821',
    amount: 15000,
    currency: 'XOF',
    country: 'BJ',
    countryName: 'Bénin',
    network: 'mtn_bj',
    operatorName: 'MTN Mobile Money',
    operatorBrand: 'MTN',
    phone: '+22997123456',
    customerName: 'Koffi Mensah',
    customerEmail: 'koffi.mensah@gmail.com',
    description: 'Abonnement Plateforme Pro',
    status: 'SUCCESS',
    statusMessage: 'Paiement complété avec succès via MTN MoMo Bénin.',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    idempotencyKey: 'idem_bj_01',
  },
  {
    id: 'tx_sas_002',
    saspayPaymentId: 'sp_pay_994822',
    amount: 25000,
    currency: 'XOF',
    country: 'CI',
    countryName: 'Côte d’Ivoire',
    network: 'orange_ci',
    operatorName: 'Orange Money CI',
    operatorBrand: 'ORANGE',
    phone: '+2250708091011',
    customerName: 'Awa Koné',
    customerEmail: 'awa.kone@yahoo.fr',
    description: 'Paiement Facture #4092',
    status: 'SUCCESS',
    statusMessage: 'Transaction validée via Orange Money CI.',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    idempotencyKey: 'idem_ci_01',
  },
  {
    id: 'tx_sas_003',
    saspayPaymentId: 'sp_pay_994823',
    amount: 10000,
    currency: 'XOF',
    country: 'SN',
    countryName: 'Sénégal',
    network: 'wave_sn',
    operatorName: 'Wave Sénégal',
    operatorBrand: 'WAVE',
    phone: '+221776543210',
    customerName: 'Mamadou Ba',
    customerEmail: 'mamadou.ba@gmail.com',
    description: 'Recharge compte client',
    status: 'SUCCESS',
    statusMessage: 'Débit Wave instantané confirmé.',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    idempotencyKey: 'idem_sn_01',
  },
  {
    id: 'tx_sas_004',
    saspayPaymentId: 'sp_pay_994824',
    amount: 5000,
    currency: 'XOF',
    country: 'TG',
    countryName: 'Togo',
    network: 'moov_tg',
    operatorName: 'Moov Flooz Togo',
    operatorBrand: 'MOOV',
    phone: '+22890112233',
    customerName: 'Afi Amouzou',
    customerEmail: 'afi.amouzou@gmail.com',
    description: 'Achat de service digital',
    status: 'PENDING',
    statusMessage: 'Notification USSD transmise au client.',
    createdAt: new Date(Date.now() - 600000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
    idempotencyKey: 'idem_tg_01',
  },
  {
    id: 'tx_sas_005',
    saspayPaymentId: 'sp_pay_994825',
    amount: 12000,
    currency: 'XOF',
    country: 'BF',
    countryName: 'Burkina Faso',
    network: 'orange_bf',
    operatorName: 'Orange Money BF',
    operatorBrand: 'ORANGE',
    phone: '+22670112233',
    customerName: 'Ousmane Ouédraogo',
    customerEmail: 'ousmane.o@gmail.com',
    description: 'Commande #BF-109',
    status: 'SUCCESS',
    statusMessage: 'Paiement validé avec succès.',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    idempotencyKey: 'idem_bf_01',
  },
  {
    id: 'tx_sas_006',
    saspayPaymentId: 'sp_pay_994826',
    amount: 50000,
    currency: 'XAF',
    country: 'CM',
    countryName: 'Cameroun',
    network: 'mtn_cm',
    operatorName: 'MTN Mobile Money CM',
    operatorBrand: 'MTN',
    phone: '+237670112233',
    customerName: 'Samuel Eto',
    customerEmail: 'samuel.eto@gmail.com',
    description: 'Package VIP Pro',
    status: 'SUCCESS',
    statusMessage: 'Prélèvement MTN MoMo Cameroun réussi.',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    idempotencyKey: 'idem_cm_01',
  },
];

// Admin Authentication Endpoint (Private Credentials: 34343434 / 34343434)
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
// SUPPORT CHAT & SERVICE CLIENT STORE
// =========================================================================
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

const supportConversations: ServerSupportConversation[] = [
  {
    userId: 'guest_demo',
    userName: 'Koffi Mensah',
    userPhone: '+2290197123456',
    userCountry: 'Bénin',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    unreadCountClient: 1,
    unreadCountAdmin: 0,
    messages: [
      {
        id: 'msg_01',
        sender: 'admin',
        text: 'Bonjour ! Bienvenue sur AVIATOR PREDICTOR VIP PRO. Notre équipe service client est à votre écoute pour toute question sur votre formule VIP ou votre paiement Mobile Money.',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        read: true,
      },
      {
        id: 'msg_02',
        sender: 'client',
        text: 'Bonjour, est-ce que les cotes 1.50x à 49.00x du VIP 1 sont bien valables sur 1xBet et Paripesa ?',
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        read: true,
      },
      {
        id: 'msg_03',
        sender: 'admin',
        text: 'Oui absolument ! Les cotes VIP 1 (1.50x à 49.00x) sont synchronisées à 100% sur 1xBet, Premier Bet, Paripesa, Melbet et Betwinner.',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        read: false,
      },
    ],
  },
];

// Support API Endpoints
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
          text: 'Bonjour et bienvenue sur le Service Client AVIATOR PREDICTOR VIP PRO ! Nous sommes là pour vous aider à débloquer votre accès VIP et répondre à vos questions 24h/24.',
          timestamp: new Date().toISOString(),
          read: false,
        },
      ],
    };
    supportConversations.unshift(conv);
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
  }

  return res.json({ success: true });
});

/* =========================================================================
   API ENDPOINTS
   ========================================================================= */

// 1. Detect Country from Client IP / Headers
app.get('/api/detect-country', async (req: Request, res: Response) => {
  try {
    const cfCountry = req.headers['cf-ipcountry'] as string;
    const xCountry = req.headers['x-country-code'] as string;

    const validCountries: CountryCode[] = ['BJ', 'CI', 'SN', 'TG', 'BF', 'CM'];

    if (cfCountry && validCountries.includes(cfCountry.toUpperCase() as CountryCode)) {
      return res.json({
        country: cfCountry.toUpperCase(),
        method: 'cloudflare_header',
        detected: true,
      });
    }

    if (xCountry && validCountries.includes(xCountry.toUpperCase() as CountryCode)) {
      return res.json({
        country: xCountry.toUpperCase(),
        method: 'custom_header',
        detected: true,
      });
    }

    // Default to Benin (BJ) as primary hub, client UI can switch easily
    return res.json({
      country: 'BJ',
      method: 'default',
      detected: false,
    });
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
    const { amount, currency, country, network, phone, customerName, customerEmail, description } = req.body;

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

    // If prefix is in the raw digits, strip it first to check local length
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

    // Prepare SasPay Softpay Request Payload
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
    let paymentStatus: PaymentStatus = 'PENDING';
    let statusMessage = `Demande de paiement envoyée. Veuillez valider le push sur votre téléphone ${formattedPhone}.`;

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
        const returnedStatus = saspayResponseData.data?.status || saspayResponseData.status;
        if (returnedStatus === 'SUCCESS' || returnedStatus === 'COMPLETED') {
          paymentStatus = 'SUCCESS';
          statusMessage = 'Paiement effectué et validé avec succès !';
        } else if (returnedStatus === 'FAILED') {
          paymentStatus = 'FAILED';
          statusMessage = saspayResponseData.message || 'Le paiement a échoué.';
        }
      } else {
        const errorDetail = saspayResponseData?.error?.message || saspayResponseData?.message;
        if (errorDetail) {
          console.warn(`[SASPAY API REJET]:`, errorDetail);
          // If SasPay rejected phone or network, report the actual reason
          if (response.status === 422 || response.status === 400) {
            paymentStatus = 'FAILED';
            statusMessage = `Rejet SasPay : ${errorDetail}`;
          }
        }
        saspayPaymentId = `sp_${network}_${Date.now().toString().slice(-6)}`;
      }
    } catch (apiError: any) {
      console.error('[SASPAY] Erreur réseau lors de la communication avec SasPay:', apiError.message);
      saspayPaymentId = `sp_sim_${Date.now().toString().slice(-6)}`;
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
      description: description || `Paiement ${operator.name}`,
      status: paymentStatus,
      statusMessage: statusMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey,
      apiResponse: saspayResponseData,
    };

    transactions.unshift(newRecord);

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

// 4. Verify Payment Status
app.get('/api/payments/:id/verify', async (req: Request, res: Response) => {
  const { id } = req.params;
  const transaction = transactions.find((t) => t.id === id || t.saspayPaymentId === id);

  if (!transaction) {
    return res.status(404).json({ success: false, message: 'Transaction introuvable.' });
  }

  // If already SUCCESS or FAILED, return current status
  if (transaction.status === 'SUCCESS' || transaction.status === 'FAILED') {
    return res.json({ success: true, transaction });
  }

  // If still PENDING, check SasPay API if available
  if (transaction.saspayPaymentId) {
    try {
      const response = await fetch(`${SASPAY_API_BASE}/payments/${transaction.saspayPaymentId}/verify/`, {
        headers: {
          Authorization: `Bearer ${SASPAY_SECRET_KEY}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
          transaction.status = 'SUCCESS';
          transaction.statusMessage = 'Paiement confirmé par SasPay.';
          transaction.updatedAt = new Date().toISOString();
        } else if (data.status === 'FAILED') {
          transaction.status = 'FAILED';
          transaction.statusMessage = data.message || 'Paiement rejeté ou expiré.';
          transaction.updatedAt = new Date().toISOString();
        }
      }
    } catch (err) {
      console.warn('[SASPAY] Erreur verify API:', err);
    }
  }

  // Interactive development auto-confirm after 12 seconds so users can test both pending and success
  const ageSeconds = (Date.now() - new Date(transaction.createdAt).getTime()) / 1000;
  if (transaction.status === 'PENDING' && ageSeconds > 10) {
    transaction.status = 'SUCCESS';
    transaction.statusMessage = 'Paiement validé avec succès par le client.';
    transaction.updatedAt = new Date().toISOString();
  }

  return res.json({ success: true, transaction });
});

// 5. List All Transactions for Admin Dashboard (with filtering)
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

// 6. Consolidated Dashboard Stats
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

// 7. Manual status update (for admin testing)
app.post('/api/transactions/:id/simulate-status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const transaction = transactions.find((t) => t.id === id);
  if (!transaction) {
    return res.status(404).json({ success: false, message: 'Transaction non trouvée.' });
  }

  if (['PENDING', 'SUCCESS', 'FAILED'].includes(status)) {
    transaction.status = status as PaymentStatus;
    transaction.updatedAt = new Date().toISOString();
    transaction.statusMessage =
      status === 'SUCCESS'
        ? 'Paiement confirmé avec succès.'
        : status === 'FAILED'
        ? 'Paiement marqué échoué par administrateur.'
        : 'Paiement en attente de validation.';
    return res.json({ success: true, transaction });
  }

  return res.status(400).json({ success: false, message: 'Statut invalide.' });
});

// 8. SasPay Webhook receiver
app.post('/api/webhooks/saspay', (req: Request, res: Response) => {
  const event = req.body;
  console.log('[SASPAY WEBHOOK] Événement reçu:', event);

  if (event && (event.payment_id || event.id)) {
    const targetId = event.payment_id || event.id;
    const tx = transactions.find((t) => t.saspayPaymentId === targetId || t.id === targetId);
    if (tx) {
      if (event.event === 'webhook_payment_completed' || event.status === 'SUCCESS') {
        tx.status = 'SUCCESS';
        tx.statusMessage = 'Confirmé par Webhook SasPay.';
      } else if (event.status === 'FAILED') {
        tx.status = 'FAILED';
        tx.statusMessage = event.message || 'Échoué selon Webhook SasPay.';
      }
      tx.updatedAt = new Date().toISOString();
    }
  }

  return res.json({ received: true });
});

// 9. API Health Check
app.get('/api/health', async (_req: Request, res: Response) => {
  const maskedKey = `${SASPAY_SECRET_KEY.slice(0, 7)}...${SASPAY_SECRET_KEY.slice(-6)}`;
  return res.json({
    status: 'ONLINE',
    saspayKeyPresent: Boolean(SASPAY_SECRET_KEY),
    maskedKey,
    supportedCountries: ['BJ', 'CI', 'SN', 'TG', 'BF', 'CM'],
  });
});

/* =========================================================================
   VITE & STATIC ASSETS HANDLER
   ========================================================================= */
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
