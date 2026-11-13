import React, { useState, useEffect } from 'react';
import { LogOut, ArrowRight, CheckCircle2 } from 'lucide-react';

interface LogoutPageProps {
  onRedirectToAuth: () => void;
}

export const LogoutPage: React.FC<LogoutPageProps> = ({ onRedirectToAuth }) => {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onRedirectToAuth();
    }
  }, [countdown, onRedirectToAuth]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-3">
      <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-5 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
          <LogOut className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Session fermée</span>
          </div>
          <h1 className="text-lg font-black text-slate-900">Déconnexion réussie</h1>
          <p className="text-xs text-slate-600">
            Vos réservations, votre solde et votre historique restent enregistrés.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          Redirection vers Connexion dans <strong className="font-mono text-blue-600">{countdown}s</strong>...
        </div>

        <button
          type="button"
          onClick={onRedirectToAuth}
          className="w-full min-h-[48px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Connexion / Inscription</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
