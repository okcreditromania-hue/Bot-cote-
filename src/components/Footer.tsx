import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface FooterProps {
  onGoToLogin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onGoToLogin }) => {
  return (
    <footer className="bg-white text-slate-600 py-5 px-3 text-[11px] border-t border-slate-200 mt-auto">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-slate-900">Mobile Money Multi-Pays (XOF)</div>
          <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Cloud Firestore Actif
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-500">
          <div>🇧🇯 Bénin (XOF)</div>
          <div>🇧🇫 Burkina Faso (XOF)</div>
          <div>🇨🇮 Côte d’Ivoire (XOF)</div>
          <div>🇬🇼 Guinée-Bissau (XOF)</div>
          <div>🇲🇱 Mali (XOF)</div>
          <div>🇳🇪 Niger (XOF)</div>
          <div>🇸🇳 Sénégal (XOF)</div>
          <div>🇹🇬 Togo (XOF)</div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>© {new Date().getFullYear()} AVIATOR VIP PRO</span>
          {onGoToLogin && (
            <button
              type="button"
              onClick={onGoToLogin}
              className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
            >
              Connexion
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
