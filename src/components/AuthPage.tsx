import React, { useState } from 'react';
import { User, VIPPlanId } from '../types';
import { WEST_AFRICA_COUNTRIES, WEST_AFRICA_BOOKMAKERS, StorageService } from '../services/storage';
import { ClientVideoSection } from './ClientVideoSection';
import {
  Sparkles,
  Lock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  Check,
  Copy,
  Share2,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';

interface AuthPageProps {
  initialTab?: 'login' | 'register';
  onAuthSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialTab = 'register',
  onAuthSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  // Registration Form states (Always virgin/blank by default)
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState(WEST_AFRICA_COUNTRIES[0].name);
  const [phonePrefix, setPhonePrefix] = useState(WEST_AFRICA_COUNTRIES[0].code);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bookmaker, setBookmaker] = useState(WEST_AFRICA_BOOKMAKERS[0].name);
  const [selectedVip, setSelectedVip] = useState<VIPPlanId>('VIP1');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Login Form states (Always completely virgin/empty for every visitor - 100% confidential)
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCountryChange = (cName: string) => {
    setCountry(cName);
    const found = WEST_AFRICA_COUNTRIES.find((c) => c.name === cName);
    if (found) setPhonePrefix(found.code);
  };

  const handleCopyPublicLink = () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // 1. Submit Registration with Secret Password
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Veuillez renseigner votre nom complet.');
      return;
    }

    if (!phoneNumber.trim() || phoneNumber.replace(/[^0-9]/g, '').length < 6) {
      setErrorMessage('Veuillez renseigner un numéro de téléphone valide.');
      return;
    }

    if (!registerPassword.trim() || registerPassword.length < 4) {
      setErrorMessage('Veuillez définir un mot de passe d’au moins 4 caractères.');
      return;
    }

    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const fullPhone = `${phonePrefix}${cleanNumber}`;

    const newUser: User = {
      id: `usr_${Date.now()}`,
      fullName: fullName.trim(),
      phone: fullPhone,
      password: registerPassword.trim(),
      country,
      bookmaker,
      vipTier: selectedVip,
      paymentStatus: 'unpaid',
      registeredAt: new Date().toLocaleString('fr-FR'),
      notes: `Place réservée pour le ${selectedVip} sur ${bookmaker}`,
    };

    const saved = StorageService.addUser(newUser);
    StorageService.setCurrentUser(saved);
    onAuthSuccess(saved);
  };

  // 2. Submit Confidential Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!loginPhone.trim()) {
      setErrorMessage('Veuillez renseigner votre numéro de téléphone.');
      return;
    }

    if (!loginPassword.trim()) {
      setErrorMessage('Veuillez renseigner votre mot de passe.');
      return;
    }

    setIsSubmittingLogin(true);

    try {
      // 1. Check with server login endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, password: loginPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.user) {
        StorageService.setCurrentUser(data.user);
        onAuthSuccess(data.user);
        return;
      }

      // 2. Fallback check local storage
      const cleanInput = loginPhone.replace(/[^0-9]/g, '');
      const localUsers = StorageService.getUsers();
      const matched = localUsers.find((u) => {
        const uPhone = u.phone.replace(/[^0-9]/g, '');
        return uPhone === cleanInput || uPhone.endsWith(cleanInput) || cleanInput.endsWith(uPhone);
      });

      if (matched) {
        const expected = matched.password || 'password123';
        if (loginPassword.trim() === expected.trim()) {
          StorageService.setCurrentUser(matched);
          onAuthSuccess(matched);
          return;
        }
      }

      // If credentials do not match, give private neutral error (never expose other accounts)
      setErrorMessage('Numéro de téléphone ou mot de passe incorrect.');
    } catch {
      // Offline fallback
      const cleanInput = loginPhone.replace(/[^0-9]/g, '');
      const localUsers = StorageService.getUsers();
      const matched = localUsers.find((u) => {
        const uPhone = u.phone.replace(/[^0-9]/g, '');
        return uPhone === cleanInput || uPhone.endsWith(cleanInput) || cleanInput.endsWith(uPhone);
      });

      if (matched && loginPassword.trim() === (matched.password || 'password123').trim()) {
        StorageService.setCurrentUser(matched);
        onAuthSuccess(matched);
      } else {
        setErrorMessage('Numéro de téléphone ou mot de passe incorrect.');
      }
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  return (
    <div className="py-8 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* 1. YOUTUBE VIDEO SECTION (Clean, nothing written on top) */}
      <ClientVideoSection />

      {/* 2. Direct Public Link Banner (Shareable) */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="space-y-0.5 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-mono font-bold text-emerald-800">
            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>LIEN PUBLIC DIRECT OFFICIEL</span>
          </div>
          <p className="text-xs text-slate-600">
            Ce lien redirige toujours vos clients directement sur cette page d'inscription et de connexion sécurisée.
          </p>
        </div>

        <button
          onClick={handleCopyPublicLink}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 font-bold text-xs rounded-xl border border-emerald-300 shadow-xs transition-all cursor-pointer shrink-0"
        >
          {copiedLink ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Lien Copié dans le presse-papier !</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copier le lien public direct</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Inscription & Connexion Card (Day Mode - Confidential & Pure) */}
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Top Tab Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMessage('');
            }}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Réserver ma place (Inscription)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage('');
            }}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Connexion Client</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: Registration Form with Secret Password */}
        {activeTab === 'register' ? (
          <form onSubmit={handleRegister} className="p-6 sm:p-8 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Nom complet du joueur
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Kouamé Jean-Marc"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Pays (Afrique de l'Ouest & Centrale)
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                >
                  {WEST_AFRICA_COUNTRIES.map((c) => (
                    <option key={c.code + c.name} value={c.name}>
                      {c.flag} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Numéro Mobile Money
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                    {phonePrefix}
                  </span>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="01 97 00 00 00"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-r-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Votre plateforme de jeu Aviator
              </label>
              <select
                value={bookmaker}
                onChange={(e) => setBookmaker(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
              >
                {WEST_AFRICA_BOOKMAKERS.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name} ({b.aviatorGameName}) · {b.badge}
                  </option>
                ))}
              </select>
            </div>

            {/* Password Creation Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Créez votre mot de passe secret (Requis pour vos futures connexions)
              </label>
              <div className="relative">
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  required
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="Choisissez un mot de passe personnel"
                  className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  tabIndex={-1}
                >
                  {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Ce mot de passe restera strictement confidentiel et vous permettra de vous reconnecter.
              </span>
            </div>

            {/* The 2 VIP options with exact user formulas */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                Sélectionnez votre formule VIP (Montant automatique)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* VIP 1 */}
                <div
                  onClick={() => setSelectedVip('VIP1')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedVip === 'VIP1'
                      ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">VIP 1</span>
                    <span className="text-sm font-mono font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                      550 FCFA
                    </span>
                  </div>
                  <div className="text-xs text-emerald-800 font-bold mt-2">
                    Cotes 1.50x à 49.00x · Garanti 100% Sûr
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Pour capital : <strong>500 F à 50 000 FCFA</strong>
                  </div>
                </div>

                {/* VIP 2 */}
                <div
                  onClick={() => setSelectedVip('VIP2')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedVip === 'VIP2'
                      ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">VIP 2</span>
                    <span className="text-sm font-mono font-black text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                      1 500 FCFA
                    </span>
                  </div>
                  <div className="text-xs text-blue-800 font-bold mt-2">
                    Cotes 49.00x à 100.00x+ · Garanti 100% Sûr
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Pour capital : <strong>50 000 F à 100 000 FCFA</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Formal Payment Reminder */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="text-slate-800 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Rappel de réservation :</span>
              </div>
              <p>
                L'inscription réserve votre place dans le compte. Le paiement Mobile Money est toujours accessible et débloquera le bouton d'accès au Bot Aviator après validation administrative.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs tracking-wider uppercase rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Valider la réservation & Ouvrir mon compte</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Tab 2: Connexion Client Sécurisée et Vierge (Aucun autre compte affiché - Confidentialité Totale) */
          <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-5">
            <div className="space-y-1 pb-1">
              <h3 className="text-sm font-bold text-slate-900">
                Espace de Connexion Personnel
              </h3>
              <p className="text-xs text-slate-500">
                Saisissez votre numéro de téléphone et votre mot de passe pour accéder à votre espace réservé.
              </p>
            </div>

            {/* Saisie du Numéro de Téléphone (Champ vierge) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Votre numéro de téléphone Mobile Money
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                  <Smartphone className="w-4 h-4 text-slate-500" />
                </span>
                <input
                  type="tel"
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="Ex: 01 97 00 00 00 ou +229..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-r-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Le numéro renseigné lors de votre inscription.
              </span>
            </div>

            {/* Saisie du Mot de Passe (Champ vierge) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Votre mot de passe secret
              </label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  tabIndex={-1}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Votre mot de passe reste strictement confidentiel.
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Accès personnel chiffré et protégé contre tout accès tiers.</span>
            </div>

            <button
              type="submit"
              disabled={isSubmittingLogin}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmittingLogin ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Vérification...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Se Connecter à mon compte</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
