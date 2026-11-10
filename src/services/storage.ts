import { User, VIPPlan, AdminSettings, BookmakerPlatform, LiveSignal } from '../types';

export const WEST_AFRICA_BOOKMAKERS: BookmakerPlatform[] = [
  {
    id: '1xbet',
    name: '1xBet',
    badge: 'N°1 Afrique de l\'Ouest',
    minDeposit: '500 FCFA',
    rating: '4.9/5',
    aviatorGameName: 'Aviator Spribe & Crash',
    popularCountries: ['Bénin', 'Côte d\'Ivoire', 'Sénégal', 'Cameroun', 'Mali'],
    color: 'from-blue-600 to-sky-500',
  },
  {
    id: 'premierbet',
    name: 'Premier Bet',
    badge: 'Leader Historique',
    minDeposit: '300 FCFA',
    rating: '4.8/5',
    aviatorGameName: 'Aviator & The Navigator',
    popularCountries: ['Côte d\'Ivoire', 'Mali', 'Sénégal', 'RD Congo'],
    color: 'from-emerald-600 to-green-500',
  },
  {
    id: 'paripesa',
    name: 'Paripesa',
    badge: 'Ultra Rapide MoMo',
    minDeposit: '500 FCFA',
    rating: '4.8/5',
    aviatorGameName: 'Aviator Spribe Original',
    popularCountries: ['Bénin', 'Togo', 'Burkina Faso', 'Côte d\'Ivoire'],
    color: 'from-amber-600 to-yellow-500',
  },
  {
    id: 'melbet',
    name: 'Melbet',
    badge: 'Hautes Cotes Spribe',
    minDeposit: '500 FCFA',
    rating: '4.7/5',
    aviatorGameName: 'Aviator & Spribe Games',
    popularCountries: ['Cameroun', 'Sénégal', 'Bénin', 'Mali'],
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'betwinner',
    name: 'Betwinner',
    badge: 'Retraits Instantanés',
    minDeposit: '450 FCFA',
    rating: '4.7/5',
    aviatorGameName: 'Aviator Crash Pro',
    popularCountries: ['Côte d\'Ivoire', 'Sénégal', 'Guinée', 'Bénin'],
    color: 'from-teal-600 to-emerald-500',
  },
  {
    id: '1win',
    name: '1win',
    badge: 'Bonus Dépôt 500%',
    minDeposit: '1 000 FCFA',
    rating: '4.6/5',
    aviatorGameName: 'Lucky Jet & Aviator',
    popularCountries: ['Bénin', 'Côte d\'Ivoire', 'Sénégal', 'Togo'],
    color: 'from-indigo-600 to-purple-500',
  },
];

export const WEST_AFRICA_COUNTRIES = [
  { code: '+229', name: 'Bénin', flag: '🇧🇯' },
  { code: '+225', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: '+221', name: 'Sénégal', flag: '🇸🇳' },
  { code: '+228', name: 'Togo', flag: '🇹🇬' },
  { code: '+226', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+237', name: 'Cameroun', flag: '🇨🇲' },
  { code: '+223', name: 'Mali', flag: '🇲🇱' },
  { code: '+224', name: 'Guinée', flag: '🇬🇳' },
  { code: '+227', name: 'Niger', flag: '🇳🇪' },
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
      'Accès immédiat dès validation par l\'administrateur',
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
      'Accès immédiat et illimité après validation',
    ],
  },
};

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  adminPhone: '34343434',
  adminPin: '34343434',
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
    autoValidation: false,
  },
};

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
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveUsers(users: User[]): void {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  addUser(user: User): User {
    const users = this.getUsers();
    const cleanUserPhone = user.phone.replace(/[^0-9]/g, '');
    const existingIndex = users.findIndex((u) => u.phone.replace(/[^0-9]/g, '') === cleanUserPhone);
    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...user };
      this.saveUsers(users);
      // Also persist to server
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(users[existingIndex]),
      }).catch(console.warn);
      return users[existingIndex];
    }
    users.unshift(user);
    this.saveUsers(users);
    // Also persist to server
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    }).catch(console.warn);
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
      paymentReference: reference || user.paymentReference,
      paymentDate: status === 'paid' ? new Date().toLocaleString('fr-FR') : user.paymentDate,
      amountPaid: status === 'paid' ? (user.vipTier === 'VIP1' ? 550 : 1500) : user.amountPaid || 0,
    };
    users[index] = updated;
    this.saveUsers(users);

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      this.setCurrentUser(updated);
    }

    // Persist to server
    fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(console.warn);

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
      if (!data) return DEFAULT_ADMIN_SETTINGS;
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
];

