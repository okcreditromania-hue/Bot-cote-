import React, { useState, useEffect, useRef } from 'react';
import { TransactionRecord, DashboardStats } from '../types/saspay';
import { AviatorGameState, User } from '../types';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  RefreshCw,
  MessageSquare,
  Send,
  Phone,
  Users,
  Check,
  Trash2,
  Hourglass,
  Wallet,
  Plane,
  SlidersHorizontal,
  ArrowDownToLine,
  PlusCircle,
  X,
  FileSpreadsheet,
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
  const [activeAdminTab, setActiveAdminTab] = useState<'pending' | 'bot' | 'users' | 'transactions' | 'support'>('pending');

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [actionNotice, setActionNotice] = useState('');

  // Support state
  const [conversations, setConversations] = useState<ServerSupportConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Users state
  const [usersList, setUsersList] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});

  // Pending requests
  const [pendingPayments, setPendingPayments] = useState<TransactionRecord[]>([]);
  const [isProcessingDecision, setIsProcessingDecision] = useState<string | null>(null);

  // Live Bot / Aviator Admin control state
  const [aviatorState, setAviatorState] = useState<AviatorGameState | null>(null);
  const [nextOddInput, setNextOddInput] = useState<string>('');
  const [isSettingOdd, setIsSettingOdd] = useState(false);

  const fetchPendingPayments = async () => {
    try {
      const res = await fetch('/api/admin/pending-payments');
      if (res.ok) {
        const data = await res.json();
        if (data.pending) setPendingPayments(data.pending);
      }
    } catch {
      // ignore
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data.users) setUsersList(data.users);
      }
    } catch {
      // ignore
    }
  };

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
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPendingPayments();
    fetchUsers();
    fetchConversations();

    const eventSource = new EventSource('/api/events/stream?role=admin');
    eventSource.addEventListener('connected', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.aviatorState) setAviatorState(payload.aviatorState);
      } catch {
        // ignore
      }
    });
    eventSource.addEventListener('aviator:tick', (event) => {
      try {
        setAviatorState(JSON.parse((event as MessageEvent).data));
      } catch {
        // ignore
      }
    });
    eventSource.addEventListener('admin:update', () => {
      fetchPendingPayments();
      fetchUsers();
      fetchConversations();
      onRefreshData();
    });

    const interval = setInterval(() => {
      fetchPendingPayments();
      fetchConversations();
    }, 5000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, []);

  const activeConversation = conversations.find((c) => c.userId === selectedConversationId) || conversations[0];
  const totalUnreadAdmin = conversations.reduce((sum, c) => sum + (c.unreadCountAdmin || 0), 0);

  useEffect(() => {
    if (activeConversation && activeConversation.unreadCountAdmin > 0) {
      fetch('/api/support/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeConversation.userId, role: 'admin' }),
      }).catch(() => {});
    }
  }, [selectedConversationId, activeConversation]);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(''), 3500);
  };

  // Accept or Reject VIP Activation / Recharge / Withdrawal
  const handlePaymentDecision = async (txId: string, decision: 'ACCEPT' | 'REJECT') => {
    setIsProcessingDecision(txId);
    try {
      const res = await fetch(`/api/admin/payments/${txId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'REJECT' ? 'Opération non confirmée par l’administrateur.' : undefined,
        }),
      });

      if (res.ok) {
        showNotice(
          decision === 'ACCEPT'
            ? 'Opération confirmée et synchronisée en direct chez le client.'
            : 'Demande rejetée et mise à jour chez le client.'
        );
        fetchPendingPayments();
        fetchUsers();
        fetchConversations();
        onRefreshData();
      }
    } finally {
      setIsProcessingDecision(null);
    }
  };

  const handleToggleUserVIP = async (user: User) => {
    const newStatus = user.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: newStatus,
        adminOverride: true,
        paymentDate: newStatus === 'paid' ? new Date().toLocaleString('fr-FR') : undefined,
        notes: newStatus === 'paid' ? 'VIP activé par l’administrateur' : 'VIP désactivé par l’administrateur',
      }),
    });
    if (res.ok) {
      showNotice(`VIP de ${user.fullName} : ${newStatus === 'paid' ? 'ACTIF' : 'INACTIF'}`);
      fetchUsers();
    }
  };

  const handleAdjustBalance = async (user: User, action: 'CREDIT' | 'DEBIT') => {
    const raw = creditInputs[user.id] || '1000';
    const amount = Math.floor(Number(raw));
    if (!amount || amount <= 0) return;

    const res = await fetch(`/api/admin/users/${user.id}/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, action }),
    });
    if (res.ok) {
      showNotice(
        `${action === 'CREDIT' ? '+' : '-'}${amount.toLocaleString('fr-FR')} FCFA appliqué au solde de ${user.fullName}`
      );
      setCreditInputs((prev) => ({ ...prev, [user.id]: '' }));
      fetchUsers();
      onRefreshData();
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      showNotice(`Compte de ${userName} supprimé.`);
      fetchUsers();
    }
  };

  const handleSetNextOdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(nextOddInput);
    if (isNaN(val) || val < 1.1 || val > 200) {
      showNotice('Cote invalide (entre 1.10x et 200.00x).');
      return;
    }
    setIsSettingOdd(true);
    try {
      const res = await fetch('/api/admin/aviator/next-odd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextOdd: val }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setAviatorState(data.state);
        setNextOddInput('');
        showNotice(`Prochaine cote exacte configurée à ${val.toFixed(2)}x.`);
      }
    } finally {
      setIsSettingOdd(false);
    }
  };

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
        body: JSON.stringify({ userId: activeConversation.userId, text: textToSend }),
      });
      if (res.ok) {
        fetchConversations();
      }
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Type', 'Date', 'Client', 'Téléphone', 'Montant', 'Devise', 'Statut'];
    const rows = transactions.map((t) => [
      t.id,
      t.transactionType || 'VIP_ACTIVATION',
      new Date(t.createdAt).toLocaleString('fr-FR'),
      t.customerName,
      t.phone,
      t.amount,
      t.currency,
      t.status,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `operations_admin_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesStatus = selectedStatus === 'ALL' || t.status === selectedStatus;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      t.customerName.toLowerCase().includes(q) ||
      t.phone.includes(q) ||
      t.id.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const filteredUsers = usersList.filter((u) => {
    const q = userSearchTerm.toLowerCase();
    return (
      !userSearchTerm ||
      u.fullName.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      u.bookmaker.toLowerCase().includes(q)
    );
  });

  const getCategoryMeta = (tx: TransactionRecord) => {
    const cat =
      tx.transactionType ||
      (tx.description?.toLowerCase().includes('retrait')
        ? 'WITHDRAWAL'
        : tx.description?.toLowerCase().includes('rechargement')
        ? 'RECHARGE'
        : 'VIP_ACTIVATION');
    if (cat === 'WITHDRAWAL') {
      return {
        label: 'RETRAIT MOBILE MONEY',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        borderClass: 'border-blue-300',
        icon: ArrowDownToLine,
      };
    }
    if (cat === 'RECHARGE') {
      return {
        label: 'RECHARGEMENT SOLDE',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        borderClass: 'border-emerald-300',
        icon: PlusCircle,
      };
    }
    return {
      label: 'ACTIVATION VIP',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      borderClass: 'border-amber-300',
      icon: Clock,
    };
  };

  return (
    <div className="px-3 py-4 space-y-4">
      {/* ===================================================================== */}
      {/* ADMIN TREASURY BALANCE & KPI HEADER                                   */}
      {/* ===================================================================== */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">
              Solde Administrateur (VIP + Dépôts - Retraits)
            </span>
            <div className="text-2xl font-mono font-black tabular-nums mt-0.5">
              {(stats?.adminBalance || 0).toLocaleString('fr-FR')}{' '}
              <span className="text-xs font-bold text-emerald-400">FCFA</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onRefreshData();
                fetchPendingPayments();
                fetchUsers();
                fetchConversations();
              }}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
              title="Actualiser"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer"
              title="Exporter CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
          <div>
            <span className="text-slate-400 block text-[9px]">REVENUS VIP</span>
            <span className="font-bold text-emerald-300 tabular-nums">
              +{(stats?.totalVipRevenue || 0).toLocaleString('fr-FR')} F
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">RECHARGES</span>
            <span className="font-bold text-sky-300 tabular-nums">
              +{(stats?.totalRecharges || 0).toLocaleString('fr-FR')} F
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">RETRAITS</span>
            <span className="font-bold text-rose-300 tabular-nums">
              -{(stats?.totalWithdrawals || 0).toLocaleString('fr-FR')} F
            </span>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Horizontal Scrollable Mobile Admin Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setActiveAdminTab('pending')}
          className={`min-h-[42px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer border ${
            activeAdminTab === 'pending'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Hourglass className="w-3.5 h-3.5" />
          <span>Validations</span>
          <span className="px-1.5 py-0.5 rounded bg-black/15 font-mono text-[10px]">
            {pendingPayments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('bot')}
          className={`min-h-[42px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer border ${
            activeAdminTab === 'bot'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Plane className="w-3.5 h-3.5" />
          <span>Bot & Code 15</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('users')}
          className={`min-h-[42px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer border ${
            activeAdminTab === 'users'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Clients ({usersList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('transactions')}
          className={`min-h-[42px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer border ${
            activeAdminTab === 'transactions'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Historique</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('support')}
          className={`min-h-[42px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer border ${
            activeAdminTab === 'support'
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Messages</span>
          {totalUnreadAdmin > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px]">
              {totalUnreadAdmin}
            </span>
          )}
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PENDING VALIDATION QUEUE (VIP, RECHARGE, WITHDRAWAL)           */}
      {/* ===================================================================== */}
      {activeAdminTab === 'pending' && (
        <div className="space-y-3">
          {pendingPayments.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="text-sm font-bold text-slate-900">Aucune demande en attente</div>
              <p className="text-xs text-slate-500">
                Les demandes d'activation VIP, rechargement et retrait apparaîtront ici en direct.
              </p>
            </div>
          ) : (
            pendingPayments.map((p) => {
              const meta = getCategoryMeta(p);
              const IconComp = meta.icon;
              return (
                <div
                  key={p.id}
                  className={`bg-white p-4 rounded-2xl border-2 ${meta.borderClass} shadow-sm space-y-3`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${meta.badgeClass}`}
                    >
                      <IconComp className="w-3 h-3" />
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(p.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 truncate">{p.customerName}</h4>
                      <p className="text-xs font-mono text-slate-600 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{p.phone}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-mono font-black text-emerald-700 tabular-nums">
                        {p.amount.toLocaleString('fr-FR')} {p.currency}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {p.countryName} · {p.operatorName}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 space-y-0.5">
                    <div>{p.description}</div>
                    {p.bookmakerUserId && (
                      <div className="font-mono font-bold text-blue-700">
                        ID Site de Paris : {p.bookmakerUserId}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isProcessingDecision === p.id}
                      onClick={() => handlePaymentDecision(p.id, 'ACCEPT')}
                      className="flex-1 min-h-[46px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirmer</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessingDecision === p.id}
                      onClick={() => handlePaymentDecision(p.id, 'REJECT')}
                      className="min-h-[46px] py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      <span>Rejeter</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: BOT & CODE 15 LIVE CONTROL                                     */}
      {/* ===================================================================== */}
      {activeAdminTab === 'bot' && (
        <div className="space-y-3">
          <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase block">
                  Serveur Aviator En Direct
                </span>
                <h3 className="text-sm font-black">Tour #{aviatorState?.roundNumber || '--'}</h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 font-mono text-xs font-bold text-amber-300 tabular-nums">
                {aviatorState?.phase === 'COUNTDOWN'
                  ? `DÉPART DANS ${aviatorState.countdownSeconds}s`
                  : aviatorState?.phase === 'FLYING'
                  ? `EN VOL : ${aviatorState.currentMultiplier.toFixed(2)}x`
                  : `ENVOLÉ @ ${aviatorState?.currentMultiplier.toFixed(2)}x`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] font-mono text-slate-400 block">CODE 15 ACTUEL</span>
                <span className="font-mono font-black text-xs text-amber-300">
                  {aviatorState?.code15 || '--'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] font-mono text-slate-400 block">COTE EXACTE PRÉVUE</span>
                <span className="font-mono font-black text-lg text-emerald-400 tabular-nums">
                  {aviatorState?.nextCrashPoint ? `${aviatorState.nextCrashPoint.toFixed(2)}x` : '--'}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSetNextOdd} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-black text-slate-900 uppercase">
                Configurer la Prochaine Cote Exacte
              </h4>
            </div>
            <p className="text-[11px] text-slate-600">
              Définissez la cote exacte du prochain tour (diffusée automatiquement 10s avant le départ aux membres VIP actifs).
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="1.10"
                max="200"
                value={nextOddInput}
                onChange={(e) => setNextOddInput(e.target.value)}
                placeholder="Ex: 12.50"
                className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                disabled={isSettingOdd}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase cursor-pointer disabled:opacity-50"
              >
                Appliquer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: USERS MANAGEMENT (MOBILE CARDS + SOLDE + VIP)                  */}
      {/* ===================================================================== */}
      {activeAdminTab === 'users' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              placeholder="Rechercher nom, téléphone, bookmaker..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          {filteredUsers.map((u) => {
            const isPaid = u.paymentStatus === 'paid';
            const uBal = typeof u.balance === 'number' ? u.balance : 0;
            return (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-sm text-slate-900 truncate">{u.fullName}</div>
                    <div className="font-mono text-xs text-slate-500">{u.phone}</div>
                    <div className="text-[11px] text-slate-600">
                      {u.country} · <strong className="text-blue-700">{u.bookmaker}</strong> · {u.vipTier}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isPaid ? 'VIP ACTIF' : 'NON PAYÉ'}
                    </span>
                    <div className="font-mono font-black text-sm text-slate-900 mt-1 tabular-nums">
                      <Wallet className="w-3 h-3 inline mr-1 text-emerald-600" />
                      {uBal.toLocaleString('fr-FR')} F
                    </div>
                  </div>
                </div>

                {/* Adjust Balance Row */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                  <input
                    type="number"
                    min={100}
                    step={500}
                    value={creditInputs[u.id] ?? ''}
                    onChange={(e) => setCreditInputs((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    placeholder="Montant F"
                    className="flex-1 min-w-0 px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjustBalance(u, 'CREDIT')}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                  >
                    + Solde
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustBalance(u, 'DEBIT')}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
                  >
                    - Solde
                  </button>
                </div>

                {/* VIP Toggle & Delete */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleUserVIP(u)}
                    className={`flex-1 min-h-[42px] py-2 px-3 rounded-xl text-xs font-bold cursor-pointer ${
                      isPaid
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isPaid ? 'Désactiver VIP' : 'Activer VIP Maintenant'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.id, u.fullName)}
                    className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: ALL TRANSACTIONS (MOBILE CARDS)                                */}
      {/* ===================================================================== */}
      {activeAdminTab === 'transactions' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher client ou réf..."
              className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs"
            />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs"
            >
              <option value="ALL">Tous</option>
              <option value="PENDING">En attente</option>
              <option value="SUCCESS">Validé</option>
              <option value="FAILED">Rejeté</option>
            </select>
          </div>

          {filteredTransactions.map((tx) => {
            const meta = getCategoryMeta(tx);
            return (
              <div key={tx.id} className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                  <span
                    className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded ${
                      tx.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : tx.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{tx.customerName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{tx.phone}</div>
                  </div>
                  <div className="text-right font-mono font-black text-sm text-slate-900 shrink-0">
                    {tx.amount.toLocaleString('fr-FR')} {tx.currency}
                  </div>
                </div>
                {tx.status === 'PENDING' && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handlePaymentDecision(tx.id, 'ACCEPT')}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentDecision(tx.id, 'REJECT')}
                      className="py-2 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer"
                    >
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: MOBILE SUPPORT MESSAGES                                        */}
      {/* ===================================================================== */}
      {activeAdminTab === 'support' && (
        <div className="space-y-3">
          {conversations.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
              Aucune conversation client pour le moment.
            </div>
          ) : (
            <>
              {/* Select Client Conversation horizontally */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {conversations.map((c) => (
                  <button
                    key={c.userId}
                    type="button"
                    onClick={() => setSelectedConversationId(c.userId)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      activeConversation?.userId === c.userId
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{c.userName}</span>
                    {c.unreadCountAdmin > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px]">
                        {c.unreadCountAdmin}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {activeConversation && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-[420px]">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{activeConversation.userName}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {activeConversation.userPhone || activeConversation.userCountry}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
                    {activeConversation.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${m.sender === 'admin' ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                            m.sender === 'admin'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-800 border border-slate-200'
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSendReply} className="p-2.5 border-t border-slate-200 flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Répondre au client..."
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim() || isSendingReply}
                      className="min-w-[44px] min-h-[42px] px-3 bg-blue-600 text-white rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
