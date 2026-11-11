import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';

interface FooterProps {
  onOpenAdminGate: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdminGate }) => {
  return (
    <footer className="bg-white text-slate-600 py-12 text-xs border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                M
              </div>
              <span className="text-base font-black text-slate-900 tracking-tight">
                Passerelle Mobile Money · Multi-Pays
              </span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed max-w-md">
              Plateforme professionnelle d'encaissement Mobile Money multi-opérateurs connectée directement aux réseaux télécoms certifiés (MTN, Orange, Moov, Wave, Celtiis).
            </p>
            <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Chiffrement bancaire TLS 256 bits · Serveur sécurisé</span>
            </div>
          </div>

          {/* Pays & Devises */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Couverture Régionale
            </div>
            <ul className="space-y-1.5 text-slate-600">
              <li>🇧🇯 Bénin (MTN, Moov, Celtiis)</li>
              <li>🇨🇮 Côte d’Ivoire (Orange, MTN, Wave, Moov)</li>
              <li>🇸🇳 Sénégal (Orange, Wave, Yas)</li>
              <li>🇹🇬 Togo (Moov, MTN)</li>
              <li>🇧🇫 Burkina Faso (Orange, Moov)</li>
              <li>🇨🇲 Cameroun (MTN, Orange)</li>
            </ul>
          </div>

          {/* Conformité & API */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Sécurité & Protocoles
            </div>
            <ul className="space-y-1.5 text-slate-600 font-mono text-[11px]">
              <li>Protocol : HTTPS / TLS 1.3</li>
              <li>Validation : Push USSD Télécom</li>
              <li>Protection anti-fraude active</li>
              <li>Chiffrement de bout en bout</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} AVIATOR PREDICTOR VIP PRO · Système de Paiement Sécurisé. Tous droits réservés.
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Paiement Mobile Money Sécurisé
            </span>
            {/* Discreet and hidden trigger for admin gate */}
            <button
              onClick={onOpenAdminGate}
              className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors cursor-pointer"
              title="Accès sécurisé"
              aria-label="Accès sécurisé"
            >
              <Lock className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
