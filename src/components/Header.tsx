import React from 'react';
import { User } from '../types';
import { ShieldCheck, Lock, LogOut, ArrowLeft, Play, User as UserIcon, Check } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  isAdminAuthenticated: boolean;
  currentView: 'auth' | 'client' | 'admin' | 'logout';
  onNavigate: (view: 'auth' | 'client' | 'admin' | 'logout') => void;
  onClientLogout: () => void;
  onAdminLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isAdminAuthenticated,
  currentView,
  onNavigate,
  onClientLogout,
  onAdminLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Public Brand Name */}
        <button
          onClick={() => onNavigate(currentUser ? 'client' : 'auth')}
          className="flex items-center gap-2.5 text-left group focus:outline-none rounded-lg shrink-0 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-blue-600 flex items-center justify-center shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform">
            <svg
              className="w-5 h-5 text-white transform -rotate-45"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
          </div>
          <div>
            <div className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2 whitespace-nowrap">
              AVIATOR PREDICTOR VIP PRO
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                OFFICIEL
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono -mt-0.5">
              Afrique de l'Ouest & Centrale · Spribe AI
            </div>
          </div>
        </button>

        {/* Zone 2: Navigation Links (concise, customer-oriented) */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <button
            onClick={() => onNavigate(currentUser ? 'client' : 'auth')}
            className="hover:text-emerald-700 transition-colors cursor-pointer"
          >
            Espace Joueur & Réservation VIP
          </button>
          <span className="text-slate-400 font-normal">
            1xBet · Premier Bet · Paripesa · Melbet · Betwinner
          </span>
        </nav>

        {/* Zone 3: Header Right (User Status & Déconnexion) */}
        <div className="flex items-center gap-3 shrink-0">
          {currentView === 'admin' && isAdminAuthenticated ? (
            /* Admin controls */
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('client')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Guichet Client
              </button>
              <button
                onClick={onAdminLogout}
                className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                Déconnexion Admin
              </button>
            </div>
          ) : currentUser ? (
            /* Logged-in Customer View: Shows Profile & Real Logout Button */
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center">
                  {currentUser.fullName.slice(0, 1).toUpperCase()}
                </div>
                <span className="font-semibold text-slate-800 max-w-[120px] truncate">
                  {currentUser.fullName}
                </span>
                <span className={`text-[10px] font-mono px-1.5 rounded ${
                  currentUser.paymentStatus === 'paid'
                    ? 'bg-emerald-100 text-emerald-800 font-bold'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {currentUser.paymentStatus === 'paid' ? 'VIP Actif' : 'Non Payé'}
                </span>
              </div>

              {/* The Dedicated Logout Button */}
              <button
                onClick={onClientLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-2xs"
                title="Se déconnecter de mon compte"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Déconnexion</span>
              </button>
            </div>
          ) : (
            /* Public View when not logged in */
            <button
              onClick={() => onNavigate('auth')}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Connexion / Inscription
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
