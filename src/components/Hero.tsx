import React from 'react';
import { User } from '../types';
import { StorageService } from '../services/storage';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Smartphone,
  Lock,
} from 'lucide-react';

interface HeroProps {
  currentUser: User | null;
  onOpenAuth: (tab: 'login' | 'register') => void;
  onNavigateToDashboard: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  currentUser,
  onOpenAuth,
  onNavigateToDashboard,
}) => {
  const vipPlans = StorageService.getVipPlans();

  return (
    <div className="relative pt-8 pb-16 lg:pt-14 lg:pb-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Headlines & CTA */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Algorithme Prédictif Officiel Casino Aviator</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black text-white tracking-tight text-balance leading-tight">
              Ne jouez plus au hasard sur Aviator. Anticipez chaque décollage.
            </h1>

            <p className="text-base text-slate-300 leading-relaxed text-balance">
              Le premier bot synchronisé avec les serveurs Spribe pour <strong>1xBet, Premier Bet, Paripesa, Melbet et Betwinner</strong> en Afrique de l'Ouest.
            </p>

            {/* Crucial user-requested detail in hero */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>2 Places VIP Uniquement Disponibles</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-rose-500/30">
                  <div className="font-bold text-rose-400">VIP 1 · 550 FCFA</div>
                  <div className="text-slate-300 text-[11px] mt-0.5">
                    Pour capital de <strong>500 F à 50 000 F</strong>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/30">
                  <div className="font-bold text-amber-400">VIP 2 · {vipPlans.VIP2.price} FCFA</div>
                  <div className="text-slate-300 text-[11px] mt-0.5">
                    Pour capital de <strong>50 000 F à 100 000 F</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Formal Payment Rule Callout */}
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <Lock className="w-4 h-4 text-rose-500 shrink-0" />
              <span>
                Paiement Mobile Money obligatoire pour débloquer le bouton de redirection vers le bot.
              </span>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {currentUser ? (
                <button
                  onClick={onNavigateToDashboard}
                  className="py-3.5 px-6 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-xl shadow-rose-950/40 flex items-center gap-2 transition-all active:scale-[0.99]"
                >
                  <span>Accéder à mon espace ({currentUser.fullName})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onOpenAuth('register')}
                    className="py-3.5 px-6 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-xl shadow-rose-950/40 flex items-center gap-2 transition-all active:scale-[0.99]"
                  >
                    <span>Réserver ma place VIP (Dès 550 F)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onOpenAuth('login')}
                    className="py-3.5 px-5 rounded-xl font-semibold text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    Déjà inscrit ? Connexion
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Hero Visual Asset */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
              <img
                src="/src/assets/images/aviator_jet_flight_1794330398386.jpg"
                alt="Aviator Bot Supersonic Jet"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

              {/* Live Overlay Badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Signaux IA Actifs · 97.8%</span>
              </div>

              {/* Bottom Quote inside Image */}
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800/80">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Cote Moyenne Encaissée</span>
                  <span className="text-rose-400 font-bold">2.45x — 8.20x</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1 font-sans">
                  Prélèvement automatique instantané par MTN & Orange Money.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
