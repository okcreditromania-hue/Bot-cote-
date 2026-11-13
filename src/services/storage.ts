import { User, VIPPlan, AdminSettings, BookmakerPlatform, LiveSignal } from '../types';

export const WEST_AFRICA_BOOKMAKERS: BookmakerPlatform[] = [
  {
    id: '1xbet',
    name: '1xBet',
    badge: 'N°1 Afrique de l\'Ouest',
    minDeposit: '500 FCFA',
    rating: '4.9/5',
    aviatorGameName: 'Jeu Aviator Spribe',
    popularCountries: ['Bénin', 'Côte d\'Ivoire', 'Sénégal', 'Cameroun', 'Mali'],
    color: 'from-blue-600 to-sky-500',
  },
  {
    id: 'premierbet',
    name: 'Premier Bet',
    badge: 'Leader Historique',
    minDeposit: '300 FCFA',
    rating: '4.8/5',
    aviatorGameName: 'Jeu Aviator Spribe',
    popularCountries: ['Côte d\'Ivoire', 'Mali', 'Sénégal', 'RD Congo'],
    color: 'from-emerald-600 to-green-500',
  },
  {
    id: 'paripesa',
    name: 'Paripesa',
    badge: 'Ultra Rapide MoMo',
    minDeposit: '500 FCFA',
    rating: '4.8/5',
    aviatorGameName: 'Jeu Aviator Spribe',
    popularCountries: ['Bénin', 'Togo', 'Burkina Faso', 'Côte d\'Ivoire'],
    color: 'from-amber-600 to-yellow-500',
  },
  {
    id: 'melbet',
    name: 'Melbet',
    badge: 'Hautes Cotes Spribe',
    minDeposit: '500 FCFA',
    rating: '4.7/5',
    aviatorGameName: 'Jeu Aviator Spribe',
    popularCountries: ['Cameroun', 'Sénégal', 'Bénin', 'Mali'],
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'betwinner',
    name: 'Betwinner',
    badge: 'Retraits Instantanés',
    minDeposit: '450 FCFA',
    rating: '4.7/5',
    aviatorGameName: 'Jeu Aviator Spribe',
    popularCountries: ['Côte d\'Ivoire', 'Sénégal', 'Guinée', 'Bénin'],
    color: 'from-teal-600 to-emerald-500',
  },
];

export const WEST_AFRICA_COUNTRIES = [
  { code: '+229', iso: 'BJ', name: 'Bénin', flag: '🇧🇯', currency: 'XOF' },
  { code: '+226', iso: 'BF', name: 'Burkina Faso', flag: '🇧🇫', currency: 'XOF' },
  { code: '+225', iso: 'CI', name: 'Côte d’Ivoire', flag: '🇨🇮', currency: 'XOF' },
  { code: '+245', iso: 'GW', name: 'Guinée-Bissau', flag: '🇬🇼', currency: 'XOF' },
  { code: '+223', iso: 'ML', name: 'Mali', flag: '🇲🇱', currency: 'XOF' },
  { code: '+227', iso: 'NE', name: 'Niger', flag: '🇳🇪', currency: 'XOF' },
  { code: '+221', iso: 'SN', name: 'Sénégal', flag: '🇸🇳', currency: 'XOF' },
  { code: '+228', iso: 'TG', name: 'Togo', flag: '🇹🇬', currency: 'XOF' },
];

const DEFAULT_VIP_PLANS: Record<'VIP1' | 'VIP2', VIPPlan> = {
  VIP1: {
    id: 'VIP1',
    name: 'VIP 1 — Cotes 1.50x à 49.00x',
    price: 550,
    capitalMin: 500,
    capitalMax: 50000,
    availableSeats: 2,
    totalSeats: 2,
    badge: 'Garanti 100% Sûr',
    description: 'Conçu pour capital de 500 F à 50 000 FCFA. Cotes de 1.50x à 49.00x garanti 100% sûr.',
    multiplierRange: '1.50x — 49.00x',
    successRate: '100% Sûr Garanti',
    recommendedFor: 'Capital de 500 FCFA à 50 000 FCFA',
    features: [
      'Cotes prédictives de 1.50x à 49.00x (Garanti 100% sûr)',
      'Spécialement optimisé pour capital de 500 F à 50 000 FCFA',
      'Compatible 1xBet, Premier Bet, Paripesa, Melbet & Betwinner',
      'Signaux en temps réel avec cashout de sécurité',
      '2 places disponibles uniquement',
      'Accès immédiat dès validation du paiement Mobile Money',
    ],
  },
  VIP2: {
    id: 'VIP2',
    name: 'VIP 2 — Cotes 49.00x à 100.00x+',
    price: 1500,
    capitalMin: 50000,
    capitalMax: 100000,
    availableSeats: 2,
    totalSeats: 2,
    badge: 'Garanti 100% Sûr',
    description: 'Réservé aux capitaux de 50 000 F à 100 000 FCFA. Cotes géantes de 49.00x à 100.00x+ garanti 100% sûr.',
    multiplierRange: '49.00x — 100.00x+',
    successRate: '100% Sûr Garanti',
    recommendedFor: 'Capital de 50 000 FCFA à 100 000 FCFA',
    features: [
      'Cotes explosives de 49.00x à 100.00x+ (Garanti 100% sûr)',
      'Détection automatique des pics roses et multiplicateurs 100x',
      'Conçu pour gros capital de 50 000 F à 100 000 FCFA',
      'Compatible 1xBet, Premier Bet, Paripesa, Melbet & Betwinner',
      '2 places disponibles uniquement',
      'Accès immédiat et illimité après paiement',
    ],
  },
};

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  adminPhone: 'admin',
  adminPin: '7788',
  botRedirectUrl: 'https://t.me/AviatorPredictorBotVIP_bot',
  botTitle: 'Bot Aviator AI Predictor v4.2 Pro',
  vip1Price: 550,
  vip1Seats: 2,
  vip2Price: 1500,
  vip2Seats: 2,
  momoConfig: {
    provider: 'MTN',
    merchantPhone: '+229 97 00 00 00',
    merchantName: 'AVIATOR BOT PRO VIP',
    apiKey: '',
    secretKey: '',
    webhookUrl: 'https://api.votre-serveur.com/api/momo/callback',
    autoValidation: true,
  },
};

const INITIAL_DEMO_USERS: User[] = [];

export const INITIAL_SIGNALS: LiveSignal[] = [
  {
    id: 'sig_1',
    game: '1xBet Aviator',
    predictedMultiplier: '2.45x',
    safetyCashout: '1.95x',
    probability: '98.5%',
    validUntil: 'Dans 45 sec',
    status: 'ACTIVE',
  },
  {
    id: 'sig_2',
    game: 'Paripesa Aviator',
    predictedMultiplier: '4.80x',
    safetyCashout: '3.20x',
    probability: '96.2%',
    validUntil: 'Tour suivant',
    status: 'NEXT',
  },
  {
    id: 'sig_3',
    game: 'Premier Bet Aviator',
    predictedMultiplier: '1.88x',
    safetyCashout: '1.70x',
    probability: '99.1%',
    validUntil: 'Gagné (1.92x)',
    status: 'WON',
  },
  {
    id: 'sig_4',
    game: 'Melbet Aviator',
    predictedMultiplier: '3.15x',
    safetyCashout: '2.50x',
    probability: '97.4%',
    validUntil: 'Gagné (3.40x)',
    status: 'WON',
  },
];

const STORAGE_KEYS = {
  USERS: 'aviator_bot_users',
  CURRENT_USER: 'aviator_bot_current_user',
  ADMIN_SETTINGS: 'aviator_bot_admin_settings',
  ADMIN_SESSION: 'aviator_bot_admin_logged',
};

export const StorageService = {
  getUsers(): User[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_DEMO_USERS));
        return INITIAL_DEMO_USERS;
      }
      const parsed: User[] = JSON.parse(data);
      return parsed.map((u) => ({
        ...u,
        password: u.password || 'password123',
      }));
    } catch {
      return INITIAL_DEMO_USERS;
    }
  },

  saveUsers(users: User[]): void {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  addUser(user: User): User {
    const users = this.getUsers();
    // Check if phone already registered
    const existingIndex = users.findIndex((u) => u.phone.replace(/\s+/g, '') === user.phone.replace(/\s+/g, ''));
    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...user };
      this.saveUsers(users);
      return users[existingIndex];
    }
    users.unshift(user);
    this.saveUsers(users);
    return user;
  },

  updateUserPayment(
    userId: string,
    status: 'paid' | 'pending' | 'unpaid',
    method: 'MTN' | 'ORANGE' | 'MOOV' | 'WAVE' = 'MTN',
    reference?: string
  ): User | null {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return null;

    const user = users[index];
    const updated: User = {
      ...user,
      paymentStatus: status,
      paymentMethod: method,
      paymentReference: reference || `MOMO-${Date.now().toString().slice(-6)}`,
      paymentDate: status === 'paid' ? new Date().toLocaleString('fr-FR') : user.paymentDate,
      amountPaid: status === 'paid' ? (user.vipTier === 'VIP1' ? 550 : 1500) : 0,
    };
    users[index] = updated;
    this.saveUsers(users);

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      this.setCurrentUser(updated);
    }
    return updated;
  },

  getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },

  getAdminSettings(): AdminSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ADMIN_SETTINGS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.ADMIN_SETTINGS, JSON.stringify(DEFAULT_ADMIN_SETTINGS));
        return DEFAULT_ADMIN_SETTINGS;
      }
      return { ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_ADMIN_SETTINGS;
    }
  },

  saveAdminSettings(settings: AdminSettings): void {
    localStorage.setItem(STORAGE_KEYS.ADMIN_SETTINGS, JSON.stringify(settings));
  },

  getVipPlans(): Record<'VIP1' | 'VIP2', VIPPlan> {
    const admin = this.getAdminSettings();
    return {
      VIP1: {
        ...DEFAULT_VIP_PLANS.VIP1,
        price: admin.vip1Price,
        availableSeats: admin.vip1Seats,
      },
      VIP2: {
        ...DEFAULT_VIP_PLANS.VIP2,
        price: admin.vip2Price,
        availableSeats: admin.vip2Seats,
      },
    };
  },

  isAdminLogged(): boolean {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
  },

  setAdminLogged(logged: boolean): void {
    if (logged) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    }
  },
};
