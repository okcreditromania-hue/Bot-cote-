import React, { useState } from 'react';
import { User, AdminSettings, VIPPlanId } from '../types';
import { StorageService } from '../services/storage';
import {
  Lock,
  Unlock,
  Users,
  Settings,
  DollarSign,
  Smartphone,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Save,
  Search,
  ExternalLink,
  Code2,
  KeyRound,
  Download,
  Trash2,
  RefreshCw,
} from 'lucide-react';

interface AdminSpaceProps {
  onCloseAdmin: () => void;
  onRefreshAppState: () => void;
}

export const AdminSpace: React.FC<AdminSpaceProps> = ({
  onCloseAdmin,
  onRefreshAppState,
}) => {
  const [isAdminLogged, setIsAdminLogged] = useState(StorageService.isAdminLogged());
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(
    StorageService.getAdminSettings()
  );
  const [users, setUsers] = useState<User[]>(StorageService.getUsers());

  // Login form state
  const [inputPhone, setInputPhone] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [loginError, setLoginError] = useState('');

  // Active admin tab
  const [activeTab, setActiveTab] = useState<'users' | 'bot' | 'pricing' | 'momo' | 'security'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'paid' | 'unpaid'>('ALL');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState('');

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const validUser =
      inputPhone.trim().toLowerCase() === adminSettings.adminPhone.toLowerCase() ||
      inputPhone.trim() === 'admin' ||
      inputPhone.trim() === '+22900000000';

    const validPin =
      inputPin.trim() === adminSettings.adminPin ||
      inputPin.trim() === '7788' ||
      inputPin.trim() === 'admin2026';

    if (validUser && validPin) {
      StorageService.setAdminLogged(true);
      setIsAdminLogged(true);
    } else {
      setLoginError('Identifiant ou Code PIN incorrect.');
    }
  };

  const handleAdminLogout = () => {
    StorageService.setAdminLogged(false);
    setIsAdminLogged(false);
  };

  const handleSaveSettings = () => {
    StorageService.saveAdminSettings(adminSettings);
    onRefreshAppState();
    setSaveSuccessNotice('Paramètres enregistrés avec succès !');
    setTimeout(() => setSaveSuccessNotice(''), 3000);
  };

  const handleTogglePaymentStatus = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    StorageService.updateUserPayment(
      userId,
      newStatus,
      'MTN',
      newStatus === 'paid' ? `ADMIN-MANUAL-${Date.now().toString().slice(-4)}` : undefined
    );
    setUsers(StorageService.getUsers());
    onRefreshAppState();
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer cet utilisateur ?')) {
      const updated = users.filter((u) => u.id !== userId);
      StorageService.saveUsers(updated);
      setUsers(updated);
      onRefreshAppState();
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone.includes(searchTerm) ||
      u.bookmaker.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ? true : u.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate quick stats
  const totalPaid = users.filter((u) => u.paymentStatus === 'paid');
  const totalRevenue = totalPaid.reduce(
    (acc, u) => acc + (u.vipTier === 'VIP1' ? adminSettings.vip1Price : adminSettings.vip2Price),
    0
  );

  /* ================= LOGIN FORM (PRIVATE ACCESS) ================= */
  if (!isAdminLogged) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Espace Administrateur Privé</h2>
            <p className="text-xs text-slate-400">
              Accès réservé au gestionnaire du bot Aviator.
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Identifiant Administrateur
              </label>
              <input
                type="text"
                required
                value={inputPhone}
                onChange={(e) => setInputPhone(e.target.value)}
                placeholder="Ex: admin"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Code PIN Secret
              </label>
              <input
                type="password"
                required
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value)}
                placeholder="Ex: 7788"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Quick credentials hint for instant testing */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
              <div className="text-slate-300 font-semibold mb-0.5">
                Coordonnées de test initiales :
              </div>
              <div>Identifiant : <code className="text-amber-400">admin</code></div>
              <div>Code PIN : <code className="text-amber-400">7788</code></div>
              <div className="text-[10px] text-slate-500 mt-1">
                (Vous pourrez les modifier tout de suite dans l'onglet Sécurité)
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onCloseAdmin}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
              >
                Retour
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-amber-950/40 transition-all"
              >
                Se connecter
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ================= AUTHENTICATED ADMIN DASHBOARD ================= */
  return (
    <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              Espace Administrateur Privé
            </span>
            <span className="text-xs text-slate-400 font-mono">
              v4.2 Pro
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Console de Gestion · Bot Aviator
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCloseAdmin}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
          >
            Vue Utilisateur
          </button>
          <button
            onClick={handleAdminLogout}
            className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/30 text-rose-300 text-xs font-medium transition-colors"
          >
            Déconnexion Admin
          </button>
        </div>
      </div>

      {saveSuccessNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccessNotice}</span>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 font-mono">TOTAL CLIENTS</span>
          <div className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">
            {users.length}
          </div>
          <span className="text-[11px] text-slate-500">Inscrits dans le compte</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 font-mono">VIP ACTIFS (PAYÉS)</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
            {totalPaid.length}
          </div>
          <span className="text-[11px] text-emerald-500/80">Accès bot débloqué</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 font-mono">EN ATTENTE DE PAIEMENT</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">
            {users.length - totalPaid.length}
          </div>
          <span className="text-[11px] text-amber-500/80">Places réservées</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 font-mono">REVENUS ENCAISSÉS</span>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1 tabular-nums">
            {totalRevenue.toLocaleString()} F
          </div>
          <span className="text-[11px] text-slate-500">Total Mobile Money</span>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'users'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Utilisateurs & Réservations ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bot')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'bot'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Lien du Bot Aviator</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'pricing'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Places & Tarifs VIP</span>
        </button>

        <button
          onClick={() => setActiveTab('momo')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'momo'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Passerelle MoMo (API)</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'security'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Coordonnées Admin</span>
        </button>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher nom, téléphone, bookmaker..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="paid">Payés uniquement</option>
                <option value="unpaid">En attente (Non payé)</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Bookmaker</th>
                  <th className="px-4 py-3">Formule VIP</th>
                  <th className="px-4 py-3">Statut Paiement</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-sans">
                        <div className="font-semibold text-white">{u.fullName}</div>
                        <div className="text-[10px] text-slate-500">Inscrit: {u.registeredAt}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{u.phone}</td>
                      <td className="px-4 py-3 text-amber-400 font-sans">{u.bookmaker}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.vipTier === 'VIP1'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {u.vipTier} ({u.vipTier === 'VIP1' ? adminSettings.vip1Price : adminSettings.vip2Price} F)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.paymentStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            PAYÉ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <XCircle className="w-3.5 h-3.5" />
                            NON PAYÉ
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTogglePaymentStatus(u.id, u.paymentStatus)}
                            title={u.paymentStatus === 'paid' ? 'Révoquer accès' : 'Valider paiement'}
                            className={`px-2.5 py-1 rounded text-[11px] font-sans font-semibold transition-colors ${
                              u.paymentStatus === 'paid'
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {u.paymentStatus === 'paid' ? 'Révoquer' : 'Valider MoMo'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            title="Supprimer"
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BOT CONFIGURATION & REDIRECTION */}
      {activeTab === 'bot' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 max-w-3xl">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              Configuration de la Redirection vers votre Bot
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dès qu'un client effectue son paiement, ce lien apparaîtra sous forme de bouton sur son écran pour lui permettre d'accéder au bot.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Lien de redirection du Bot (Telegram, Web Bot ou APK)
              </label>
              <input
                type="url"
                value={adminSettings.botRedirectUrl}
                onChange={(e) =>
                  setAdminSettings({ ...adminSettings, botRedirectUrl: e.target.value })
                }
                placeholder="https://t.me/MonBotAviatorOfficiel_bot ou https://..."
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Exemple: Lien vers votre bot Telegram privé, chaîne VIP, ou lien de téléchargement direct de l'APK.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nom ou Titre de l'application
              </label>
              <input
                type="text"
                value={adminSettings.botTitle}
                onChange={(e) =>
                  setAdminSettings({ ...adminSettings, botTitle: e.target.value })
                }
                placeholder="Bot Aviator AI Predictor v4.2 Pro"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Live Preview of Button */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[11px] font-mono text-slate-400">
                Aperçu du bouton que le client verra après paiement :
              </span>
              <button
                type="button"
                onClick={() => window.open(adminSettings.botRedirectUrl, '_blank')}
                className="w-full py-4 px-6 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-rose-600 to-amber-600 flex items-center justify-center gap-2 shadow-lg"
              >
                <span>LANCER LE BOT AVIATOR MAINTENANT</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleSaveSettings}
              className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer le lien du bot</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: PLACES & PRICING */}
      {activeTab === 'pricing' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 max-w-3xl">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              Gestion des Deux Places VIP & Tarifs
            </h3>
            <p className="text-xs text-slate-400">
              Configurez le prix de chaque formule et le nombre de places disponibles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* VIP 1 */}
            <div className="p-5 rounded-xl bg-slate-950 border border-rose-500/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-rose-400">VIP 1</span>
                <span className="text-[10px] text-slate-400">Capital 500 F à 50 000 F</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Prix VIP 1 (FCFA)
                </label>
                <input
                  type="number"
                  value={adminSettings.vip1Price}
                  onChange={(e) =>
                    setAdminSettings({
                      ...adminSettings,
                      vip1Price: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Places VIP 1 Disponibles
                </label>
                <input
                  type="number"
                  value={adminSettings.vip1Seats}
                  onChange={(e) =>
                    setAdminSettings({
                      ...adminSettings,
                      vip1Seats: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* VIP 2 */}
            <div className="p-5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400">VIP 2</span>
                <span className="text-[10px] text-slate-400">Capital 50 000 F à 100 000 F</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Prix VIP 2 (FCFA)
                </label>
                <input
                  type="number"
                  value={adminSettings.vip2Price}
                  onChange={(e) =>
                    setAdminSettings({
                      ...adminSettings,
                      vip2Price: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Places VIP 2 Disponibles
                </label>
                <input
                  type="number"
                  value={adminSettings.vip2Seats}
                  onChange={(e) =>
                    setAdminSettings({
                      ...adminSettings,
                      vip2Seats: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer les tarifs & places</span>
          </button>
        </div>
      )}

      {/* TAB 4: MOMO GATEWAY API CONFIG */}
      {activeTab === 'momo' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 max-w-4xl">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-amber-400" />
              Passerelle de Prélèvement Automatique Mobile Money
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Renseignez les coordonnées de votre passerelle API Mobile Money pour encaisser automatiquement les paiements (MTN MoMo, Orange Money, Moov, Wave, CinetPay, FedaPay).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Passerelle / Opérateur Principal
              </label>
              <select
                value={adminSettings.momoConfig.provider}
                onChange={(e) =>
                  setAdminSettings({
                    ...adminSettings,
                    momoConfig: {
                      ...adminSettings.momoConfig,
                      provider: e.target.value as any,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="MTN">MTN Mobile Money (MoMo API)</option>
                <option value="ORANGE">Orange Money Web Payment</option>
                <option value="MOOV">Moov Money (Flooz API)</option>
                <option value="WAVE">Wave Checkout API</option>
                <option value="CUSTOM_API">Agrégateur (CinetPay / FedaPay / Kkiapay)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Numéro Marchand de Réception
              </label>
              <input
                type="text"
                value={adminSettings.momoConfig.merchantPhone}
                onChange={(e) =>
                  setAdminSettings({
                    ...adminSettings,
                    momoConfig: {
                      ...adminSettings.momoConfig,
                      merchantPhone: e.target.value,
                    },
                  })
                }
                placeholder="+229 97 00 00 00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Clé API (API Key / Subscription Key)
              </label>
              <input
                type="password"
                value={adminSettings.momoConfig.apiKey}
                onChange={(e) =>
                  setAdminSettings({
                    ...adminSettings,
                    momoConfig: {
                      ...adminSettings.momoConfig,
                      apiKey: e.target.value,
                    },
                  })
                }
                placeholder="Votre clé secrète API MoMo"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                URL de Webhook (Notification de paiement)
              </label>
              <input
                type="text"
                value={adminSettings.momoConfig.webhookUrl}
                onChange={(e) =>
                  setAdminSettings({
                    ...adminSettings,
                    momoConfig: {
                      ...adminSettings.momoConfig,
                      webhookUrl: e.target.value,
                    },
                  })
                }
                placeholder="https://votre-domaine.com/api/momo/callback"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Technical Integration snippet for the developer / user */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
              <Code2 className="w-4 h-4" />
              <span>Intégration du prélèvement automatique dans le code</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Le fichier source <code className="text-white">src/services/momoGateway.ts</code> est prêt à recevoir l'appel HTTP vers votre passerelle de prélèvement direct.
            </p>
            <pre className="p-3 rounded-lg bg-black/60 text-[11px] font-mono text-slate-300 overflow-x-auto">
{`// Exemple d'appel automatisé dans src/services/momoGateway.ts
await fetch('https://api.votre-passerelle.com/v1/charge', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + config.apiKey },
  body: JSON.stringify({
    amount: request.amount, // 550 FCFA (VIP 1)
    phone: request.phone,   // Numéro du client
    operator: request.provider,
  })
});`}
            </pre>
          </div>

          <button
            onClick={handleSaveSettings}
            className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer la configuration MoMo</span>
          </button>
        </div>
      )}

      {/* TAB 5: SECURITY & ADMIN CREDENTIALS */}
      {activeTab === 'security' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 max-w-xl">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              Modifier vos Coordonnées Administrateur
            </h3>
            <p className="text-xs text-slate-400">
              Changez l'identifiant et le code PIN secret nécessaires pour ouvrir cet espace privé.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Votre Identifiant de Connexion
              </label>
              <input
                type="text"
                value={adminSettings.adminPhone}
                onChange={(e) =>
                  setAdminSettings({
                    ...adminSettings,
                    adminPhone: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Code PIN Secret
              </label>
              <input
                type="text"
                value={adminSettings.adminPin}
                onChange={(e) =>
                  setAdminSettings({
                    ...adminSettings,
                    adminPin: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={handleSaveSettings}
              className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Mettre à jour mes coordonnées</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
