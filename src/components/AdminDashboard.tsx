import React, { useState, useEffect, useRef } from 'react';
import { TransactionRecord, DashboardStats, PaymentStatus } from '../types/saspay';
import { COUNTRIES_LIST } from '../data/countries';
import { User } from '../types';
import {
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  CreditCard,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  X,
  FileSpreadsheet,
  FileCode,
  Globe,
  Layers,
  KeyRound,
  MessageSquare,
  Send,
  User as UserIcon,
  Phone,
  CheckCheck,
  Users,
  Check,
  ShieldAlert,
  Trash2,
  Sparkles,
  Hourglass,
  SlidersHorizontal,
} from 'lucide-react';

interface AdminDashboardProps {
  transactions: TransactionRecord[];
  stats: DashboardStats | null;
  onRefreshData: () => void;
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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  transactions,
  stats,
  onRefreshData,
}) => {
  // Navigation tabs for Admin Console
  const [activeAdminTab, setActiveAdminTab] = useState<'pending' | 'users' | 'transactions' | 'support'>('pending');

  // Search & Filter state for Transactions
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTxDetail, setSelectedTxDetail] = useState<TransactionRecord | null>(null);
  const [actionNotice, setActionNotice] = useState('');

  // Support Conversations state
  const [conversations, setConversations] = useState<ServerSupportConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Users Management state
  const [usersList, setUsersList] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Pending Payments state
  const [pendingPayments, setPendingPayments] = useState<TransactionRecord[]>([]);
  const [isProcessingDecision, setIsProcessingDecision] = useState<string | null>(null);

  // Fetch pending payments
  const fetchPendingPayments = async () => {
    try {
      const res = await fetch('/api/admin/pending-payments');
      if (res.ok) {
        const data = await res.json();
        if (data.pending) setPendingPayments(data.pending);
      }
    } catch (err) {
      console.warn('Erreur chargement paiements en attente:', err);
    }
  };

  // Fetch users list
  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data.users) setUsersList(data.users);
      }
    } catch (err) {
      console.warn('Erreur chargement utilisateurs:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/admin/support/conversations');
      if (res.ok) {
        const data = await res.json();
        if (data.conversations) {
          setConversations(data.conversations);
          if (!selectedConversationId && data.conversations.length > 0) {
            setSelectedConversationId(data.conversations[0].userId);
          }
        }
      }
    } catch (err) {
      console.warn('Erreur chargement messages support admin:', err);
    }
  };

  useEffect(() => {
    fetchPendingPayments();
    fetchUsers();
    fetchConversations();
    const interval = setInterval(() => {
      fetchPendingPayments();
      fetchConversations();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeConversation = conversations.find((c) => c.userId === selectedConversationId) || conversations[0];
  const totalUnreadAdmin = conversations.reduce((sum, c) => sum + (c.unreadCountAdmin || 0), 0);

  // Mark as read by admin when conversation selected
  useEffect(() => {
    if (activeConversation && activeConversation.unreadCountAdmin > 0) {
      fetch('/api/support/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeConversation.userId, role: 'admin' }),
      }).catch(console.warn);
    }
  }, [selectedConversationId, activeConversation]);

  // Decision on payment: ACCEPT or REJECT
  const handlePaymentDecision = async (txId: string, decision: 'ACCEPT' | 'REJECT', customReason?: string) => {
    setIsProcessingDecision(txId);
    try {
      const res = await fetch(`/api/admin/payments/${txId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: customReason || (decision === 'REJECT' ? 'Paiement non confirmé sur le compte marchand.' : undefined),
        }),
      });

      if (res.ok) {
        setActionNotice(
          decision === 'ACCEPT'
            ? '✓ Paiement validé avec succès ! Le bot du client est débloqué.'
            : '✗ Demande de paiement rejetée.'
        );
        setTimeout(() => setActionNotice(''), 3500);
        fetchPendingPayments();
        fetchUsers();
        fetchConversations();
        onRefreshData();
      }
    } catch (err) {
      console.error('Erreur décision paiement:', err);
    } finally {
      setIsProcessingDecision(null);
    }
  };

  // Toggle user VIP status manually
  const handleToggleUserVIP = async (user: User) => {
    const newStatus = user.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: newStatus,
          paymentDate: newStatus === 'paid' ? new Date().toLocaleString('fr-FR') : undefined,
          notes: newStatus === 'paid' ? 'VIP activé manuellement par admin' : 'Accès révoqué par admin',
        }),
      });
      if (res.ok) {
        setActionNotice(`Statut VIP de ${user.fullName} mis à jour : ${newStatus === 'paid' ? 'ACTIF' : 'DÉSACTIVÉ'}`);
        setTimeout(() => setActionNotice(''), 3000);
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Change user VIP Tier
  const handleChangeUserTier = async (user: User, newTier: 'VIP1' | 'VIP2') => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vipTier: newTier }),
      });
      if (res.ok) {
        setActionNotice(`Formule de ${user.fullName} changée pour : ${newTier}`);
        setTimeout(() => setActionNotice(''), 3000);
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Confirmez-vous la suppression du compte de ${userName} ?`)) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setActionNotice(`Utilisateur ${userName} supprimé.`);
        setTimeout(() => setActionNotice(''), 3000);
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send admin reply in chat
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConversation || isSendingReply) return;

    const textToSend = replyText.trim();
    setReplyText('');
    setIsSendingReply(true);

    try {
      const res = await fetch('/api/admin/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeConversation.userId,
          text: textToSend,
        }),
      });

      if (res.ok) {
        fetchConversations();
        setActionNotice('Réponse transmise avec succès au client !');
        setTimeout(() => setActionNotice(''), 3000);
      }
    } catch (err) {
      console.error('Erreur envoi réponse:', err);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    const matchesCountry = selectedCountry === 'ALL' || t.country === selectedCountry;
    const matchesStatus = selectedStatus === 'ALL' || t.status === selectedStatus;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      t.customerName.toLowerCase().includes(q) ||
      t.phone.includes(q) ||
      t.id.toLowerCase().includes(q) ||
      (t.saspayPaymentId && t.saspayPaymentId.toLowerCase().includes(q)) ||
      t.operatorName.toLowerCase().includes(q) ||
      t.countryName.toLowerCase().includes(q);

    return matchesCountry && matchesStatus && matchesSearch;
  });

  // Filter users
  const filteredUsers = usersList.filter((u) => {
    const q = userSearchTerm.toLowerCase();
    return (
      !userSearchTerm ||
      u.fullName.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      u.country.toLowerCase().includes(q) ||
      u.bookmaker.toLowerCase().includes(q)
    );
  });

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Transaction',
      'Réf Passerelle',
      'Date',
      'Client',
      'Téléphone',
      'Pays',
      'Opérateur',
      'Montant',
      'Devise',
      'Statut',
      'Description',
    ];

    const rows = filteredTransactions.map((t) => [
      t.id,
      t.saspayPaymentId || '',
      `"${new Date(t.createdAt).toLocaleString('fr-FR')}"`,
      `"${t.customerName.replace(/"/g, '""')}"`,
      `"${t.phone}"`,
      `"${t.countryName} (${t.country})"`,
      `"${t.operatorName}"`,
      t.amount,
      t.currency,
      t.status,
      `"${t.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transactions_aviator_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner (Day Mode) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Console d'Administration Aviator VIP
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Identifiant : <strong>34343434</strong>
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Gestion & Contrôle des Opérations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Validation manuelle des paiements, gestion des utilisateurs inscrits et messagerie en direct.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              onRefreshData();
              fetchPendingPayments();
              fetchUsers();
              fetchConversations();
            }}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Rafraîchir toutes les données"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 4 Main Admin Tabs */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto">
        {/* Tab 1: Validation des Paiements */}
        <button
          onClick={() => setActiveAdminTab('pending')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors shrink-0 ${
            activeAdminTab === 'pending'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Hourglass className="w-4 h-4" />
          <span>Demandes de Validation</span>
          {pendingPayments.length > 0 ? (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
              {pendingPayments.length} en attente
            </span>
          ) : (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              0
            </span>
          )}
        </button>

        {/* Tab 2: Gestion des Utilisateurs */}
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors shrink-0 ${
            activeAdminTab === 'users'
              ? 'border-blue-600 text-blue-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestion des Utilisateurs</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {usersList.length}
          </span>
        </button>

        {/* Tab 3: Transactions & Historique */}
        <button
          onClick={() => setActiveAdminTab('transactions')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors shrink-0 ${
            activeAdminTab === 'transactions'
              ? 'border-slate-800 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Toutes les Transactions</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {transactions.length}
          </span>
        </button>

        {/* Tab 4: Messages Service Client */}
        <button
          onClick={() => setActiveAdminTab('support')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors shrink-0 ${
            activeAdminTab === 'support'
              ? 'border-teal-600 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Messages Clients</span>
          {totalUnreadAdmin > 0 ? (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
              {totalUnreadAdmin}
            </span>
          ) : (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {conversations.length}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: VALIDATION DES PAIEMENTS (ACCEPTER OU REJETER)
          ========================================================================= */}
      {activeAdminTab === 'pending' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold mb-1">
                <Hourglass className="w-3.5 h-3.5 text-amber-600" />
                <span>Paiements en attente de votre décision</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Menu de Validation Manuelle des Transactions
              </h2>
              <p className="text-xs text-slate-500">
                Chaque paiement initié par un joueur arrive ici. Appuyez sur <strong>Accepter</strong> pour débloquer immédiatement l'accès au bot sur son compte ou sur <strong>Rejeter</strong> pour refuser.
              </p>
            </div>

            <button
              onClick={fetchPendingPayments}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser les demandes</span>
            </button>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Aucune demande de paiement en attente
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Toutes les opérations ont été traitées. Dès qu'un client initie un paiement Mobile Money sur son compte, sa fiche apparaîtra ici avec les boutons Accepter et Rejeter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingPayments.map((p) => (
                <div
                  key={p.id}
                  className="bg-white p-6 rounded-2xl border-2 border-amber-300 shadow-md space-y-4 relative"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block uppercase">
                        Demande reçue
                      </span>
                      <h4 className="text-base font-black text-slate-900">{p.customerName}</h4>
                      <p className="text-xs font-mono text-slate-600 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <strong>{p.phone}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black font-mono text-emerald-600 tabular-nums">
                        {p.amount.toLocaleString()}{' '}
                        <span className="text-xs font-bold text-slate-500">{p.currency}</span>
                      </span>
                      <span className="text-[11px] font-bold block text-blue-600">{p.description}</span>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px]">PAYS & RÉSEAU</span>
                      <span className="font-bold text-slate-800">
                        {p.countryName} · {p.operatorName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">RÉFÉRENCE</span>
                      <span className="font-bold text-slate-800 truncate block">{p.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">RÉF PASSERELLE</span>
                      <span className="text-blue-700 truncate block">{p.saspayPaymentId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">HEURE DEMANDE</span>
                      <span className="text-slate-700">
                        {new Date(p.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* The Two Mandatory Buttons: CONFIRMER OU REJETER */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={isProcessingDecision === p.id}
                      onClick={() => handlePaymentDecision(p.id, 'ACCEPT')}
                      className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirmer</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessingDecision === p.id}
                      onClick={() => handlePaymentDecision(p.id, 'REJECT')}
                      className="py-3 px-4 bg-rose-50 hover:bg-rose-100 active:scale-[0.99] text-rose-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      <span>Rejeter</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: GESTION DES UTILISATEURS (NOMBRE, INFOS & CONTRÔLE)
          ========================================================================= */}
      {activeAdminTab === 'users' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold uppercase">TOTAL UTILISATEURS</span>
              <div className="text-3xl font-black font-mono text-slate-900 mt-2">{usersList.length}</div>
              <span className="text-xs text-slate-400 mt-1 block">Inscrits dans le système</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold uppercase">ACCÈS VIP DÉBLOQUÉS</span>
              <div className="text-3xl font-black font-mono text-emerald-600 mt-2">
                {usersList.filter((u) => u.paymentStatus === 'paid').length}
              </div>
              <span className="text-xs text-emerald-700 mt-1 block">Paiements validés</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold uppercase">NON PAYÉS / EN ATTENTE</span>
              <div className="text-3xl font-black font-mono text-amber-600 mt-2">
                {usersList.filter((u) => u.paymentStatus !== 'paid').length}
              </div>
              <span className="text-xs text-amber-700 mt-1 block">Places réservées</span>
            </div>
          </div>

          {/* User List Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Rechercher par nom, téléphone, pays ou bookmaker..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              <button
                onClick={fetchUsers}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Actualiser la liste</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-mono border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Client & Téléphone</th>
                    <th className="px-4 py-3">Pays & Bookmaker</th>
                    <th className="px-4 py-3">Formule VIP</th>
                    <th className="px-4 py-3">Statut VIP</th>
                    <th className="px-4 py-3">Date d'inscription</th>
                    <th className="px-4 py-3 text-right">Actions Manuelles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Aucun utilisateur inscrit pour l'instant.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isPaid = u.paymentStatus === 'paid';
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{u.fullName}</div>
                            <div className="font-mono text-[11px] text-slate-500">{u.phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{u.country}</div>
                            <div className="text-[11px] font-mono text-blue-700 font-bold">{u.bookmaker}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  u.vipTier === 'VIP1'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {u.vipTier} ({u.vipTier === 'VIP1' ? '550 F' : '1 500 F'})
                              </span>
                              <button
                                onClick={() => handleChangeUserTier(u, u.vipTier === 'VIP1' ? 'VIP2' : 'VIP1')}
                                className="text-[10px] text-slate-400 hover:text-slate-700 underline ml-1 cursor-pointer"
                                title="Basculer formule"
                              >
                                Changer
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                VIP ACTIF (DÉVERROUILLÉ)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                NON PAYÉ (RÉSERVÉ)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {u.registeredAt || 'Récemment'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Toggle VIP */}
                              <button
                                onClick={() => handleToggleUserVIP(u)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                                  isPaid
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                                title={isPaid ? 'Révoquer accès VIP' : 'Activer VIP directement'}
                              >
                                {isPaid ? 'Désactiver VIP' : 'Activer VIP'}
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteUser(u.id, u.fullName)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Supprimer utilisateur"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: TOUTES LES TRANSACTIONS & HISTORIQUE
          ========================================================================= */}
      {activeAdminTab === 'transactions' && (
        <div className="space-y-6 animate-in fade-in">
          {/* KPI Cards Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-medium block">VOLUME TOTAL VALIDÉ</span>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">
                {(stats?.totalVolume || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">FCFA</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-medium block">TRANSACTIONS ACCEPTÉES</span>
              <div className="text-2xl font-black font-mono text-emerald-600 mt-2 tabular-nums">
                {stats?.successfulTransactions || 0}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-medium block">EN ATTENTE VALIDATION</span>
              <div className="text-2xl font-black font-mono text-amber-600 mt-2 tabular-nums">
                {pendingPayments.length}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-medium block">REJETÉES / ÉCHOUÉES</span>
              <div className="text-2xl font-black font-mono text-rose-600 mt-2 tabular-nums">
                {stats?.failedTransactions || 0}
              </div>
            </div>
          </div>

          {/* Transactions Filter & Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher par client, téléphone ou référence..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 bg-white focus:outline-none"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="PENDING">En attente admin</option>
                  <option value="SUCCESS">Validé (Réussi)</option>
                  <option value="FAILED">Rejeté / Échoué</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-mono border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Réf</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Opérateur & Pays</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Aucune transaction enregistrée pour le moment.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{tx.id}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{tx.customerName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{tx.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{tx.operatorName}</span> ({tx.countryName})
                        </td>
                        <td className="px-4 py-3 font-mono font-black text-slate-900">
                          {tx.amount.toLocaleString()} {tx.currency}
                        </td>
                        <td className="px-4 py-3">
                          {tx.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              VALIDÉ
                            </span>
                          ) : tx.status === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                              EN ATTENTE DÉCISION
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              REJETÉ
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {tx.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentDecision(tx.id, 'ACCEPT')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer shadow-2xs"
                                  title="Confirmer ce paiement"
                                >
                                  Confirmer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentDecision(tx.id, 'REJECT')}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                                  title="Rejeter ce paiement"
                                >
                                  Rejeter
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedTxDetail(tx)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs cursor-pointer"
                            >
                              Détails
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
        </div>
      )}

      {/* =========================================================================
          TAB 4: MESSAGES SERVICE CLIENT
          ========================================================================= */}
      {activeAdminTab === 'support' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[580px] animate-in fade-in">
          {/* Left Column: Client Conversations List */}
          <div className="w-full md:w-80 border-r border-slate-200 bg-slate-50/50 flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Conversations Clients</h3>
                <p className="text-[11px] text-slate-500">Demandes d'assistance en direct</p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {conversations.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Aucun message reçu pour le moment.
                </div>
              ) : (
                conversations.map((c) => {
                  const isSelected = activeConversation?.userId === c.userId;
                  const lastMessage = c.messages[c.messages.length - 1];
                  return (
                    <button
                      key={c.userId}
                      onClick={() => setSelectedConversationId(c.userId)}
                      className={`w-full p-4 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                        isSelected ? 'bg-white border-l-4 border-l-blue-600 shadow-xs' : 'hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {c.userName.slice(0, 1).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-slate-900 truncate">{c.userName}</span>
                          {c.unreadCountAdmin > 0 && (
                            <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                              {c.unreadCountAdmin}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                          <span>{c.userPhone || 'N/A'}</span>
                          <span>·</span>
                          <span>{c.userCountry}</span>
                        </div>

                        {lastMessage && (
                          <p className="text-xs text-slate-600 truncate mt-1">
                            {lastMessage.sender === 'admin' ? 'Vous : ' : ''}
                            {lastMessage.text}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Chat Thread & Reply Form */}
          {activeConversation ? (
            <div className="flex-1 flex flex-col bg-white">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center">
                    {activeConversation.userName.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{activeConversation.userName}</span>
                      <span className="text-xs font-normal text-slate-500">
                        ({activeConversation.userCountry})
                      </span>
                    </h4>
                    <p className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{activeConversation.userPhone}</span>
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Discussion Ouverte
                </span>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/40">
                {activeConversation.messages.map((m) => {
                  const isAdmin = m.sender === 'admin';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          {isAdmin ? 'Administrateur (Vous)' : activeConversation.userName}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                          isAdmin
                            ? 'bg-blue-600 text-white rounded-tr-xs font-medium'
                            : 'bg-white text-slate-900 border border-slate-200 rounded-tl-xs'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={handleSendReply}
                className="p-4 border-t border-slate-200 bg-white flex items-center gap-3"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Répondre à ${activeConversation.userName}...`}
                  className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSendingReply}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-slate-400">
              Sélectionnez une conversation pour afficher les messages.
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTxDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-sm font-bold text-slate-900">
                Détails Transaction · {selectedTxDetail.id}
              </span>
              <button
                onClick={() => setSelectedTxDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">CLIENT</span>
                  <span className="font-bold text-slate-800">{selectedTxDetail.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">TÉLÉPHONE</span>
                  <span className="font-mono font-bold text-slate-800">{selectedTxDetail.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">MONTANT</span>
                  <span className="font-bold text-emerald-600">
                    {selectedTxDetail.amount} {selectedTxDetail.currency}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">STATUT</span>
                  <span className="font-bold">{selectedTxDetail.status}</span>
                </div>
              </div>

              {/* Action buttons if still pending */}
              {selectedTxDetail.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handlePaymentDecision(selectedTxDetail.id, 'ACCEPT');
                      setSelectedTxDetail(null);
                    }}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Accepter le paiement
                  </button>
                  <button
                    onClick={() => {
                      handlePaymentDecision(selectedTxDetail.id, 'REJECT');
                      setSelectedTxDetail(null);
                    }}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Rejeter
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[11px] font-mono text-slate-500">Payload Brut API :</span>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedTxDetail, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
