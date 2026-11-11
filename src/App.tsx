import React, { useState, useEffect } from 'react';
import { User, VIPPlanId } from './types';
import { StorageService } from './services/storage';
import { TransactionRecord, DashboardStats } from './types/saspay';
import { Header } from './components/Header';
import { ClientAccount } from './components/ClientAccount';
import { AuthPage } from './components/AuthPage';
import { LogoutPage } from './components/LogoutPage';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginGate } from './components/AdminLoginGate';
import { Footer } from './components/Footer';
import { SupportChatWidget } from './components/SupportChatWidget';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => StorageService.getCurrentUser());

  // Enforce direct public landing: always land on 'auth' (Inscription / Connexion) by default
  const [currentView, setCurrentView] = useState<'auth' | 'client' | 'admin' | 'logout'>(() => {
    // If user explicitly visits #admin, handle that, otherwise always start on auth (inscription/connexion)
    if (typeof window !== 'undefined' && window.location.hash === '#admin') {
      return localStorage.getItem('saspay_admin_auth') === 'authenticated_34343434' ? 'admin' : 'auth';
    }
    // Respect active logged-in user if already in session, otherwise 'auth'
    return StorageService.getCurrentUser() ? 'client' : 'auth';
  });

  // Admin authentication state (34343434 / 34343434)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('saspay_admin_auth') === 'authenticated_34343434';
  });
  const [isAdminLoginGateOpen, setIsAdminLoginGateOpen] = useState(false);

  // Admin Data state
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Check URL hash (#admin) for private admin access
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin') {
        if (isAdminAuthenticated) {
          setCurrentView('admin');
        } else {
          setIsAdminLoginGateOpen(true);
        }
      } else if (window.location.hash === '#auth' || window.location.hash === '#inscription') {
        setCurrentView('auth');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (isAdminAuthenticated) {
          setCurrentView('admin');
        } else {
          setIsAdminLoginGateOpen(true);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAdminAuthenticated]);

  // Fetch admin transactions & stats
  const fetchTransactionsAndStats = async () => {
    try {
      const [txRes, statsRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/stats'),
      ]);

      if (txRes.ok) {
        const txData = await txRes.json();
        if (txData.transactions) setTransactions(txData.transactions);
      }

      if (statsRes.ok) {
        const sData = await statsRes.json();
        if (sData.stats) setStats(sData.stats);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  };

  useEffect(() => {
    fetchTransactionsAndStats();
  }, []);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    StorageService.setCurrentUser(user);
    setCurrentView('client');
  };

  const handleClientLogout = () => {
    StorageService.setCurrentUser(null);
    setCurrentUser(null);
    setCurrentView('logout');
  };

  const handleRedirectToAuth = (tab: 'login' | 'register' = 'login') => {
    setCurrentView('auth');
  };

  const handlePaymentSuccess = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    StorageService.setCurrentUser(updatedUser);
    fetchTransactionsAndStats();
  };

  const handleOpenAdminGate = () => {
    if (isAdminAuthenticated) {
      setCurrentView('admin');
    } else {
      setIsAdminLoginGateOpen(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setCurrentView('admin');
    window.location.hash = '#admin';
    fetchTransactionsAndStats();
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('saspay_admin_auth');
    localStorage.removeItem('saspay_admin_user');
    setIsAdminAuthenticated(false);
    setCurrentView('auth');
    if (window.location.hash === '#admin') {
      window.location.hash = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white antialiased">
      {/* Top Header with Public Brand Name AVIATOR PREDICTOR VIP PRO */}
      <Header
        currentUser={currentUser}
        isAdminAuthenticated={isAdminAuthenticated}
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'admin' && !isAdminAuthenticated) {
            setIsAdminLoginGateOpen(true);
          } else {
            setCurrentView(view);
          }
        }}
        onClientLogout={handleClientLogout}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'admin' && isAdminAuthenticated ? (
          /* ================= 1. PRIVATE ADMIN SPACE ================= */
          <div>
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 text-xs text-white">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-slate-200">
                    Console d'Administration Aviator VIP · Connecté : <strong>34343434</strong>
                  </span>
                </div>
                <button
                  onClick={handleAdminLogout}
                  className="text-slate-400 hover:text-white underline text-xs font-mono cursor-pointer"
                >
                  Fermer la session
                </button>
              </div>
            </div>
            <AdminDashboard
              transactions={transactions}
              stats={stats}
              onRefreshData={fetchTransactionsAndStats}
            />
          </div>
        ) : currentView === 'logout' ? (
          /* ================= 2. LOGOUT CONFIRMATION PAGE ================= */
          <LogoutPage onRedirectToAuth={handleRedirectToAuth} />
        ) : currentView === 'client' && currentUser ? (
          /* ================= 3. AUTHENTIC CLIENT ACCOUNT ================= */
          <ClientAccount
            user={currentUser}
            onPaymentSuccess={handlePaymentSuccess}
            onLogout={handleClientLogout}
          />
        ) : (
          /* ================= 4. PUBLIC INSCRIPTION & CONNEXION PAGE ================= */
          <AuthPage
            initialTab="register"
            onAuthSuccess={handleAuthSuccess}
          />
        )}
      </main>

      {/* Floating Customer Support Chat Widget with Notification Bubble (Bulle de notification) */}
      <SupportChatWidget currentUser={currentUser} />

      {/* Private Admin Login Gate (Protected by 34343434 / 34343434) */}
      <AdminLoginGate
        isOpen={isAdminLoginGateOpen}
        onClose={() => setIsAdminLoginGateOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Footer with Discreet Hidden Admin Portal Trigger */}
      <Footer onOpenAdminGate={handleOpenAdminGate} />
    </div>
  );
}
