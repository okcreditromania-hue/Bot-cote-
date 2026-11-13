import React, { useState, useEffect } from 'react';
import { User } from './types';
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

  const [currentView, setCurrentView] = useState<'auth' | 'client' | 'admin' | 'logout'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#admin') {
      return localStorage.getItem('saspay_admin_auth') === 'authenticated_34343434' ? 'admin' : 'auth';
    }
    return StorageService.getCurrentUser() ? 'client' : 'auth';
  });

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('saspay_admin_auth') === 'authenticated_34343434';
  });
  const [isAdminLoginGateOpen, setIsAdminLoginGateOpen] = useState(false);

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

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
    } catch {
      // ignore transient error
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

  const handleRedirectToAuth = () => {
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

  const hasBottomNav = currentView === 'client' && currentUser?.paymentStatus === 'paid';

  return (
    <div className="min-h-screen w-full bg-slate-200 flex justify-center overflow-x-hidden">
      {/* STRICT MOBILE-ONLY APP SHELL (max-w-[430px], no zoom, narrow viewport) */}
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white antialiased shadow-2xl relative overflow-x-hidden">
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

        <main className="flex-1 w-full">
          {currentView === 'admin' && isAdminAuthenticated ? (
            <div>
              <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 text-[11px] text-white flex items-center justify-between">
                <span className="font-mono text-slate-200">
                  Admin : <strong>34343434</strong>
                </span>
                <button
                  onClick={handleAdminLogout}
                  className="text-slate-300 hover:text-white underline font-mono cursor-pointer"
                >
                  Fermer session
                </button>
              </div>
              <AdminDashboard
                transactions={transactions}
                stats={stats}
                onRefreshData={fetchTransactionsAndStats}
              />
            </div>
          ) : currentView === 'logout' ? (
            <LogoutPage onRedirectToAuth={handleRedirectToAuth} />
          ) : currentView === 'client' && currentUser ? (
            <ClientAccount
              user={currentUser}
              onPaymentSuccess={handlePaymentSuccess}
              onLogout={handleClientLogout}
            />
          ) : (
            <AuthPage
              initialTab="register"
              onAuthSuccess={handleAuthSuccess}
              onAdminLoginSuccess={handleAdminLoginSuccess}
            />
          )}
        </main>

        {/* Hide footer when mobile bottom navigation is active to keep viewport uncluttered */}
        {!hasBottomNav && <Footer onOpenAdminGate={handleOpenAdminGate} />}

        <SupportChatWidget currentUser={currentUser} hasBottomNav={hasBottomNav} />

        <AdminLoginGate
          isOpen={isAdminLoginGateOpen}
          onClose={() => setIsAdminLoginGateOpen(false)}
          onLoginSuccess={handleAdminLoginSuccess}
        />
      </div>
    </div>
  );
}
