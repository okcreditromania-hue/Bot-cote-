import React from 'react';
import { User } from '../types';
import { LogOut } from 'lucide-react';

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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs w-full">
      <div className="px-3 h-14 flex items-center justify-between gap-2">
        {/* Mobile Brand */}
        <button
          onClick={() => onNavigate(currentUser ? 'client' : 'auth')}
          className="flex items-center gap-2 text-left min-w-0 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-blue-600 flex items-center justify-center shadow-xs shrink-0">
            <svg
              className="w-4 h-4 text-white transform -rotate-45"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black tracking-tight text-slate-900 truncate">
              AVIATOR VIP PRO
            </div>
            <div className="text-[10px] text-slate-500 font-mono truncate">
              Mobile · Code 15 Live
            </div>
          </div>
        </button>

        {/* Right Compact Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {currentView === 'admin' && isAdminAuthenticated ? (
            <>
              {currentUser && (
                <button
                  onClick={() => onNavigate('client')}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Client
                </button>
              )}
              <button
                onClick={onAdminLogout}
                className="px-2.5 py-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer"
              >
                Quitter Admin
              </button>
            </>
          ) : currentUser ? (
            <button
              onClick={onClientLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Quitter</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('auth')}
              className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 rounded-xl shadow-2xs cursor-pointer"
            >
              Compte
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
