import React, { useState } from 'react';
import { User, VIPPlanId } from '../types';
import { WEST_AFRICA_COUNTRIES, WEST_AFRICA_BOOKMAKERS, StorageService } from '../services/storage';
import { X, CheckCircle2, ShieldAlert, Sparkles, ArrowRight, Lock } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialTab: 'login' | 'register';
  selectedTier?: VIPPlanId;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialTab,
  selectedTier = 'VIP1',
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const vipPlans = StorageService.getVipPlans();

  // Register form state
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState(WEST_AFRICA_COUNTRIES[0].name);
  const [phonePrefix, setPhonePrefix] = useState(WEST_AFRICA_COUNTRIES[0].code);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bookmaker, setBookmaker] = useState(WEST_AFRICA_BOOKMAKERS[0].name);
  const [vipTier, setVipTier] = useState<VIPPlanId>(selectedTier);

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleCountryChange = (cName: string) => {
    setCountry(cName);
    const found = WEST_AFRICA_COUNTRIES.find((c) => c.name === cName);
    if (found) setPhonePrefix(found.code);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Veuillez entrer votre nom complet.');
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.length < 6) {
      setErrorMessage('Veuillez entrer un numéro de téléphone valide.');
      return;
    }

    const fullPhone = `${phonePrefix}${phoneNumber.replace(/\s+/g, '')}`;

    const newUser: User = {
      id: `usr_${Date.now()}`,
      fullName: fullName.trim(),
      phone: fullPhone,
      country,
      bookmaker,
      vipTier,
      paymentStatus: 'unpaid',
      registeredAt: new Date().toLocaleString('fr-FR'),
      notes: `Place réservée pour le ${vipTier} sur ${bookmaker}`,
    };

    const saved = StorageService.addUser(newUser);
    StorageService.setCurrentUser(saved);
    onSuccess(saved);
    onClose();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!loginPhone.trim()) {
      setErrorMessage('Veuillez renseigner votre numéro de téléphone.');
      return;
    }

    const cleanInput = loginPhone.replace(/\s+/g, '');
    const users = StorageService.getUsers();
    const existing = users.find(
      (u) => u.phone.replace(/[^0-9]/g, '').includes(cleanInput.replace(/[^0-9]/g, ''))
    );

    if (existing) {
      StorageService.setCurrentUser(existing);
      onSuccess(existing);
      onClose();
    } else {
      // Connecter ou créer un compte rapide
      const defaultUser: User = {
        id: `usr_${Date.now()}`,
        fullName: 'Client ' + cleanInput.slice(-4),
        phone: cleanInput.startsWith('+') ? cleanInput : `+229${cleanInput}`,
        country: 'Bénin',
        bookmaker: '1xBet',
        vipTier: 'VIP1',
        paymentStatus: 'unpaid',
        registeredAt: new Date().toLocaleString('fr-FR'),
      };
      const saved = StorageService.addUser(defaultUser);
      StorageService.setCurrentUser(saved);
      onSuccess(saved);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMessage('');
            }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'register'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Réserver ma place (Inscription)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage('');
            }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'login'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Connexion Membre
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: Inscription & Réservation */}
        {activeTab === 'register' ? (
          <form onSubmit={handleRegister} className="p-6 space-y-4">
            <div>
              <div className="text-sm font-semibold text-white">
                Réservation de votre place VIP
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Inscription requise pour réserver l'une des{' '}
                <strong className="text-rose-400">2 places VIP disponibles</strong>.
              </p>
            </div>

            {/* Nom & Prénom */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nom complet
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Jean Paul Kouamé"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Pays & Téléphone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Pays (Afrique de l'Ouest)
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  {WEST_AFRICA_COUNTRIES.map((c) => (
                    <option key={c.code + c.name} value={c.name}>
                      {c.flag} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Numéro Mobile Money
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 rounded-l-lg border border-r-0 border-slate-800 bg-slate-800/60 text-slate-300 text-xs font-mono">
                    {phonePrefix}
                  </span>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="97 00 00 00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-r-lg text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Bookmaker Aviator */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Votre plateforme de jeu Aviator
              </label>
              <select
                value={bookmaker}
                onChange={(e) => setBookmaker(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
              >
                {WEST_AFRICA_BOOKMAKERS.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name} — {b.aviatorGameName} ({b.badge})
                  </option>
                ))}
              </select>
            </div>

            {/* Choix de la formule VIP (VIP 1 ou VIP 2) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Sélectionnez votre formule VIP
                </label>
                <span className="text-[11px] text-rose-400 font-mono">
                  2 places max / formule
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {/* VIP 1 */}
                <div
                  onClick={() => setVipTier('VIP1')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    vipTier === 'VIP1'
                      ? 'border-rose-500 bg-rose-500/10 shadow-sm'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">VIP 1</span>
                    <span className="text-xs font-mono font-bold text-rose-400">
                      {vipPlans.VIP1.price} FCFA
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Capital : <strong>500 à 50 000 F</strong>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-1">
                    Précision: 97.8% · 2 places
                  </div>
                </div>

                {/* VIP 2 */}
                <div
                  onClick={() => setVipTier('VIP2')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    vipTier === 'VIP2'
                      ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">VIP 2</span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {vipPlans.VIP2.price} FCFA
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Capital : <strong>50 000 à 100 000 F</strong>
                  </div>
                  <div className="text-[10px] text-amber-400 font-mono mt-1">
                    Cotes 15.00x+ · 2 places
                  </div>
                </div>
              </div>
            </div>

            {/* Avertissement Paiement Formel */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="text-slate-200 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />
                Règle de validation d'accès au Bot :
              </div>
              <p>
                L'inscription réserve votre place dans le système. Sans le paiement, l'accès au bot reste verrouillé. Dès le paiement Mobile Money effectué, le bouton direct vers l'application du bot sera activé.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <span>Valider la réservation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Tab 2: Connexion */
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <div className="text-sm font-semibold text-white">
                Connexion à votre compte
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Saisissez le numéro de téléphone utilisé lors de votre réservation.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Numéro de téléphone
              </label>
              <input
                type="tel"
                required
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                placeholder="Ex: +229 97 12 34 56 ou 07080910"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
              💡 <em>Astuce :</em> Si vous avez déjà effectué votre paiement Mobile Money, votre statut VIP sera immédiatement restauré avec le lien du bot actif.
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <span>Accéder à mon compte</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
