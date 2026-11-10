import React, { useState, useEffect } from 'react';
import { LogOut, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface LogoutPageProps {
  onRedirectToAuth: (tab: 'login' | 'register') => void;
}

export const LogoutPage: React.FC<LogoutPageProps> = ({ onRedirectToAuth }) => {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onRedirectToAuth('login');
    }
  }, [countdown, onRedirectToAuth]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6 animate-in fade-in">
        {/* Logout Icon */}
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto shadow-sm">
          <LogOut className="w-7 h-7 text-slate-800" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Déconnexion Sécurisée</span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Vous avez été déconnecté avec succès
          </h1>

          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Votre session a été clôturée en toute sécurité. Vos réservations de places VIP et votre statut sont conservés dans notre système.
          </p>
        </div>

        {/* Notice & Countdown */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
          <p>
            Redirection automatique vers la page de <strong>Connexion / Inscription</strong> dans{' '}
            <strong className="text-blue-600 font-mono text-sm">{countdown}s</strong>...
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => onRedirectToAuth('login')}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Se Reconnecter</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onRedirectToAuth('register')}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Nouvelle Inscription</span>
          </button>
        </div>
      </div>
    </div>
  );
};
