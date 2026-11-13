import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';

interface FooterProps {
  onOpenAdminGate: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdminGate }) => {
  return (
    <footer className="bg-white text-slate-600 py-5 px-3 text-[11px] border-t border-slate-200 mt-auto">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-slate-900">Mobile Money Multi-Pays</div>
          <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Serveur Sécurisé
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-500">
          <div>🇧🇯 Bénin</div>
          <div>🇨🇮 Côte d’Ivoire</div>
          <div>🇸🇳 Sénégal</div>
          <div>🇹🇬 Togo</div>
          <div>🇧🇫 Burkina</div>
          <div>🇨🇲 Cameroun</div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>© {new Date().getFullYear()} AVIATOR VIP PRO</span>
          <button
            onClick={onOpenAdminGate}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded cursor-pointer"
            title="Accès sécurisé"
            aria-label="Accès sécurisé"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
