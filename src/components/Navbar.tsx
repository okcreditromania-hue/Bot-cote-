import React from 'react';
import { User } from '../types';
import { ShieldCheck, User as UserIcon, LogOut, Lock } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onOpenAuth: (tab: 'login' | 'register') => void;
  onLogout: () => void;
  onNavigateToDashboard: () => void;
  onOpenAdmin: () => void;
  isAdminView: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  onNavigateToDashboard,
  onOpenAdmin,
  isAdminView,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand title, single line */}
        <button
          onClick={() => {
            if (isAdminView) onNavigateToDashboard();
            else window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg shrink-0"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-600 to-red-600 flex items-center justify-center shadow-lg shadow-rose-950/50 group-hover:scale-105 transition-transform">
            <svg
              className="w-5 h-5 text-white transform -rotate-45"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white flex items-center gap-2 whitespace-nowrap">
              AVIATOR BOT VIP
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono tracking-wider -mt-0.5">
              Afrique de l'Ouest
            </div>
          </div>
        </button>

        {/* Zone 2: Navigation Links (single-line, concise) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a
            href="#vip"
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            Formules VIP
          </a>
          <a
            href="#bookmakers"
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            Bookmakers
          </a>
          <a
            href="#fonctionnement"
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            Comment ça marche
          </a>
          <a
            href="#momo"
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            Paiement MoMo
          </a>
        </nav>

        {/* Zone 3: Primary Action / User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              <button
                onClick={onNavigateToDashboard}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-rose-400 font-semibold text-[10px]">
                  {currentUser.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-medium truncate max-w-[110px]">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    {currentUser.paymentStatus === 'paid' ? (
                      <span className="text-emerald-400 flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3 inline" /> VIP Actif
                      </span>
                    ) : (
                      <span className="text-amber-400">Place Réservée</span>
                    )}
                  </div>
                </div>
              </button>

              <button
                onClick={onLogout}
                title="Se déconnecter"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg transition-colors whitespace-nowrap"
              >
                Connexion
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-lg shadow-md shadow-rose-950/40 transition-all hover:shadow-rose-900/40 active:scale-95 whitespace-nowrap"
              >
                Réserver ma place (VIP)
              </button>
            </div>
          )}

          {/* Bouton discret de bascule admin si l'admin est sur la vue */}
          {isAdminView && (
            <button
              onClick={onNavigateToDashboard}
              className="px-2.5 py-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded"
            >
              Quitter Admin
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
