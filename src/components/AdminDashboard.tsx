import React, { useState, useEffect, useRef } from 'react';
import { TransactionRecord, DashboardStats, CountryCode, PaymentStatus } from '../types/saspay';
import { COUNTRIES_LIST } from '../data/countries';
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
  const [activeAdminTab, setActiveAdminTab] = useState<'transactions' | 'support'>('transactions');

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
    fetchConversations();
    const interval = setInterval(fetchConversations, 4000);
    return () => clearInterval(interval);
  }, [selectedConversationId]);

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

  // Scroll to bottom of message thread
  useEffect(() => {
    if (activeAdminTab === 'support') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation?.messages, activeAdminTab]);

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

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Transaction',
      'ID SasPay',
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
    link.setAttribute(
      'download',
      `saspay_transactions_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setActionNotice('Rapport CSV téléchargé avec succès !');
    setTimeout(() => setActionNotice(''), 3000);
  };

  // Export to JSON
  const handleExportJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredTransactions, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute(
      'download',
      `saspay_transactions_export_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setActionNotice('Rapport JSON téléchargé avec succès !');
    setTimeout(() => setActionNotice(''), 3000);
  };

  // Quick simulate status for testing
  const handleSimulateStatus = async (id: string, status: PaymentStatus) => {
    try {
      const res = await fetch(`/api/transactions/${id}/simulate-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onRefreshData();
        setActionNotice(`Statut mis à jour : ${status}`);
        setTimeout(() => setActionNotice(''), 3000);
        if (selectedTxDetail && selectedTxDetail.id === id) {
          setSelectedTxDetail((prev) => (prev ? { ...prev, status } : null));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner (Day Mode) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              SasPay Admin Console
            </span>
            <span className="text-xs text-slate-500 font-mono">
              6 Pays Couverts (BJ, CI, SN, TG, BF, CM)
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Tableau de Bord Administrateur
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi des encaissements Mobile Money, messagerie service client et exports comptables.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              onRefreshData();
              fetchConversations();
            }}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Rafraîchir les données"
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
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-700" />
            <span>Exporter JSON</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Admin Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-3">
        <button
          onClick={() => setActiveAdminTab('transactions')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
            activeAdminTab === 'transactions'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Transactions & Encaissements</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {transactions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('support')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
            activeAdminTab === 'support'
              ? 'border-blue-600 text-blue-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Messages Service Client</span>
          {totalUnreadAdmin > 0 ? (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
              {totalUnreadAdmin} nouveau{totalUnreadAdmin > 1 ? 'x' : ''}
            </span>
          ) : (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {conversations.length}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: TRANSACTIONS & ENCAISSEMENTS
          ========================================================================= */}
      {activeAdminTab === 'transactions' && (
        <div className="space-y-8 animate-in fade-in">
          {/* KPI Cards Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Volume */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>VOLUME TOTAL ENCAISSÉ</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">
                {(stats?.totalVolume || 0).toLocaleString()} <span className="text-sm font-bold text-slate-400">FCFA</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-1">
                Devises XOF & XAF confondues
              </div>
            </div>

            {/* Successful Transactions */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>PAIEMENTS RÉUSSIS</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-600 mt-2 tabular-nums">
                {stats?.successfulTransactions || 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Taux de succès : <strong>{stats?.successRate || 0}%</strong>
              </div>
            </div>

            {/* Pending Transactions */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>EN ATTENTE (USSD)</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-amber-600 mt-2 tabular-nums">
                {stats?.pendingTransactions || 0}
              </div>
              <div className="text-[11px] text-amber-700 font-medium mt-1">
                En cours de validation mobile
              </div>
            </div>

            {/* Total Transactions */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>TOTAL TRANSACTIONS</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">
                {stats?.totalTransactions || 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Échouées : {stats?.failedTransactions || 0}
              </div>
            </div>
          </div>

          {/* Breakdown by Country & Operator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Volume by Country */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  <span>Encaissements par Pays (6)</span>
                </span>
                <span className="text-xs font-mono text-slate-400">Montant Encaissé</span>
              </h3>

              <div className="space-y-3 pt-1">
                {COUNTRIES_LIST.map((country) => {
                  const countryVol = stats?.volumeByCountry[country.code] || 0;
                  const totalVol = stats?.totalVolume || 1;
                  const percent = totalVol > 0 ? (countryVol / totalVol) * 100 : 0;

                  return (
                    <div key={country.code} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span className="text-sm">{country.flag}</span>
                          <span>{country.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({country.currency})</span>
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {countryVol.toLocaleString()} {country.currency}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(percent, 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Volume by Operator */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Répartition par Opérateur</span>
                </span>
                <span className="text-xs font-mono text-slate-400">Taux de captation</span>
              </h3>

              <div className="space-y-3 pt-1">
                {stats && Object.keys(stats.volumeByOperator).length > 0 ? (
                  Object.entries(stats.volumeByOperator).map(([opName, amount]) => {
                    const totalVol = stats.totalVolume || 1;
                    const percent = (amount / totalVol) * 100;

                    return (
                      <div key={opName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{opName}</span>
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {amount.toLocaleString()} FCFA ({percent.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(percent, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-400 py-6 text-center">
                    Aucun encaissement validé pour le moment.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher client, téléphone, ID SasPay..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">Tous les 6 pays</option>
                  {COUNTRIES_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="SUCCESS">Réussi (Confirmé)</option>
                  <option value="PENDING">En attente (USSD)</option>
                  <option value="FAILED">Échoué</option>
                </select>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-mono border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Réf / SasPay ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Client & Téléphone</th>
                    <th className="px-4 py-3">Pays & Réseau</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Aucune transaction trouvée correspondant aux critères.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono">
                          <div className="font-bold text-slate-900">{tx.id}</div>
                          <div className="text-[10px] text-blue-600 font-medium">
                            {tx.saspayPaymentId || 'Attente API'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                          <span className="block text-[10px] text-slate-400">
                            {new Date(tx.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{tx.customerName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{tx.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 flex items-center gap-1">
                            <span>{tx.country === 'BJ' ? '🇧🇯' : tx.country === 'CI' ? '🇨🇮' : tx.country === 'SN' ? '🇸🇳' : tx.country === 'TG' ? '🇹🇬' : tx.country === 'BF' ? '🇧🇫' : '🇨🇲'}</span>
                            <span>{tx.countryName}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">{tx.operatorName}</div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <span className="font-black text-slate-900 text-sm tabular-nums">
                            {tx.amount.toLocaleString()}
                          </span>{' '}
                          <span className="text-[11px] text-slate-500 font-bold">{tx.currency}</span>
                        </td>
                        <td className="px-4 py-3">
                          {tx.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              RÉUSSI
                            </span>
                          ) : tx.status === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                              EN ATTENTE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              ÉCHOUÉ
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedTxDetail(tx)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Voir détail complet"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Détails</span>
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
          TAB 2: MESSAGES SERVICE CLIENT (SUPPORT MESSAGING CENTER)
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
              {/* Thread Header */}
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

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Discussion Ouverte
                  </span>
                </div>
              </div>

              {/* Message History */}
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

              {/* Reply Form */}
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
                  <span className="text-slate-400 block text-[10px] font-mono">ID SASPAY</span>
                  <span className="font-mono font-bold text-blue-600">
                    {selectedTxDetail.saspayPaymentId || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">IDEMPOTENCY KEY</span>
                  <span className="font-mono text-slate-700 truncate block">
                    {selectedTxDetail.idempotencyKey}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">STATUT ACTUEL</span>
                  <span className="font-bold">{selectedTxDetail.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">DATE CRÉATION</span>
                  <span className="font-mono text-slate-700">
                    {new Date(selectedTxDetail.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>

              {/* Simulation test triggers */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                <span className="font-bold text-blue-950 text-xs block">
                  Simulateur de mise à jour pour test (Environnement SasPay) :
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSimulateStatus(selectedTxDetail.id, 'SUCCESS')}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    Marquer Réussi
                  </button>
                  <button
                    onClick={() => handleSimulateStatus(selectedTxDetail.id, 'FAILED')}
                    className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    Marquer Échoué
                  </button>
                  <button
                    onClick={() => handleSimulateStatus(selectedTxDetail.id, 'PENDING')}
                    className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    En Attente
                  </button>
                </div>
              </div>

              {/* Raw JSON viewer */}
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

      {/* SasPay Server Config & Security info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <KeyRound className="w-4 h-4 text-emerald-600" />
          <span>Statut d'Intégration API SasPay (Côté Serveur)</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Votre clé secrète SasPay est sécurisée dans l'environnement serveur Node/Express. Elle n'est jamais exposée dans le navigateur du client.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block text-[10px]">SERVEUR API</span>
            <span className="text-slate-800 font-bold">https://api.saspay.me/api/v1</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block text-[10px]">CLÉ API SASPAY</span>
            <span className="text-emerald-700 font-bold">sk_live_Y...x8k (Active)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block text-[10px]">WEBHOOK URL</span>
            <span className="text-blue-700 font-bold">/api/webhooks/saspay</span>
          </div>
        </div>
      </div>
    </div>
  );
};
