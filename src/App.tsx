import React, { useState, useEffect, useCallback } from 'react';
import { User } from './types';
import { StorageService } from './services/storage';
import { TransactionRecord, DashboardStats } from './types/saspay';
import { Header } from './components/Header';
import { ClientAccount } from './components/ClientAccount';
import { AuthPage } from './components/AuthPage';
import { LogoutPage } from './components/LogoutPage';
import { AdminDashboard } from './components/AdminDashboard';
import { Footer } from './components/Footer';
import { SupportChatWidget } from './components/SupportChatWidget';
import { useFirebase } from './firebase/FirebaseContext';

export default function App() {
  const { isFirebaseAdmin, firebaseUser, signOutFirebase } = useFirebase();

  const [currentUser, setCurrentUser] = useState<User | null>(() => StorageService.getCurrentUser());
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#admin') {
      return 'login';
    }
    return 'register';
  });

  const [currentView, setCurrentView] = useState<'auth' | 'client' | 'admin' | 'logout'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#admin') {
      return localStorage.getItem('saspay_admin_auth') === 'authenticated_34343434' ? 'admin' : 'auth';
    }
    return StorageService.getCurrentUser() ? 'client' : 'auth';
  });

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('saspay_admin_auth') === 'authenticated_34343434';
  });

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (isFirebaseAdmin && !isAdminAuthenticated) {
      localStorage.setItem('saspay_admin_auth', 'authenticated_34343434');
      localStorage.setItem('saspay_admin_user', firebaseUser?.email || 'okcreditromania@gmail.com');
      setIsAdminAuthenticated(true);
    }
  }, [isFirebaseAdmin, isAdminAuthenticated, firebaseUser]);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin') {
        if (isAdminAuthenticated) {
          setCurrentView('admin');
        } else {
          setAuthInitialTab('login');
          setCurrentView('auth');
        }
      } else if (window.location.hash === '#auth' || window.location.hash === '#inscription') {
        setAuthInitialTab('register');
        setCurrentView('auth');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (isAdminAuthenticated) {
          setCurrentView('admin');
        } else {
          setAuthInitialTab('login');
          setCurrentView('auth');
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

  const fetchTransactionsAndStats = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchTransactionsAndStats();
  }, [fetchTransactionsAndStats]);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    StorageService.setCurrentUser(user);
    setCurrentView('client');
  };

  const handleClientLogout = async () => {
    StorageService.setCurrentUser(null);
    setCurrentUser(null);
    if (firebaseUser) {
      await signOutFirebase().catch(() => {});
    }
    setCurrentView('logout');
  };

  const handleRedirectToAuth = () => {
    setAuthInitialTab('login');
    setCurrentView('auth');
  };

  const handlePaymentSuccess = useCallback((updatedUser: User) => {
    setCurrentUser(updatedUser);
    StorageService.setCurrentUser(updatedUser);
    StorageService.addUser(updatedUser);
    fetchTransactionsAndStats();
  }, [fetchTransactionsAndStats]);

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setCurrentView('admin');
    window.location.hash = '#admin';
    fetchTransactionsAndStats();
  };

  const handleAdminLogout = async () => {
    localStorage.removeItem('saspay_admin_auth');
    localStorage.removeItem('saspay_admin_user');
    setIsAdminAuthenticated(false);
    if (firebaseUser) {
      await signOutFirebase().catch(() => {});
    }
    setAuthInitialTab('login');
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
              setAuthInitialTab('login');
              setCurrentView('auth');
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
              initialTab={authInitialTab}
              onAuthSuccess={handleAuthSuccess}
              onAdminLoginSuccess={handleAdminLoginSuccess}
            />
          )}
        </main>

        {/* Hide footer when mobile bottom navigation is active to keep viewport uncluttered */}
        {!hasBottomNav && (
          <Footer
            onGoToLogin={() => {
              setAuthInitialTab('login');
              setCurrentView('auth');
            }}
          />
        )}

        <SupportChatWidget currentUser={currentUser} hasBottomNav={hasBottomNav} />
      </div>
    </div>
  );
}
