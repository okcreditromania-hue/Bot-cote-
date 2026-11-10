import React from 'react';
import { VIPPlanId, User } from '../types';
import { StorageService } from '../services/storage';
import { Check, ShieldCheck, Flame, Zap, ArrowRight, Lock } from 'lucide-react';

interface VipCardsProps {
  currentUser: User | null;
  onSelectPlan: (planId: VIPPlanId) => void;
  onOpenPayment: (planId: VIPPlanId) => void;
  onOpenAuth: (tab: 'login' | 'register', planId: VIPPlanId) => void;
}

export const VipCards: React.FC<VipCardsProps> = ({
  currentUser,
  onSelectPlan,
  onOpenPayment,
  onOpenAuth,
}) => {
  const vipPlans = StorageService.getVipPlans();

  const handleAction = (planId: VIPPlanId) => {
    if (!currentUser) {
      onOpenAuth('register', planId);
    } else if (currentUser.paymentStatus === 'paid' && currentUser.vipTier === planId) {
      // Déjà payé pour ce plan
      onSelectPlan(planId);
    } else {
      onOpenPayment(planId);
    }
  };

  return (
    <section id="vip" className="py-16 border-b border-slate-800/60 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-rose-400 uppercase tracking-widest mb-3">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Places VIP Limitées pour Bot Aviator
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
            Deux Places VIP Disponibles · Algorithme Prédictif
          </h2>
          <p className="mt-3 text-base text-slate-400 text-balance leading-relaxed">
            Chaque formule est rigoureusement calibrée selon votre capital de départ sur 1xBet, Premier Bet, Paripesa ou Melbet. Réservez votre place avant fermeture du quota.
          </p>

          {/* Formel notice box */}
          <div className="mt-5 inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Lock className="w-4 h-4 text-rose-500 shrink-0" />
            <span>
              <strong>Note importante :</strong> Le paiement Mobile Money est toujours accessible. <em>Sans le paiement, aucun accès au bot n'est délivré.</em>
            </span>
          </div>
        </div>

        {/* 2 VIP Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* VIP 1 */}
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-rose-500/40 p-8 shadow-xl shadow-rose-950/20 flex flex-col justify-between">
            {/* Top quota bar */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-mono font-semibold text-rose-400 uppercase tracking-wider">
                  Formule 1
                </span>
                <h3 className="text-2xl font-bold text-white mt-0.5">VIP 1</h3>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-slate-400">Places disponibles</div>
                <div className="text-sm font-bold font-mono text-rose-400">
                  {vipPlans.VIP1.availableSeats} places disponibles
                </div>
              </div>
            </div>

            {/* Target Capital - Explicitly highlighted */}
            <div className="my-6 p-4 rounded-xl bg-rose-950/20 border border-rose-500/30">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                Capital Joueur Recommandé
              </div>
              <div className="text-lg font-bold text-white mt-1">
                De 500 FCFA jusqu'à 50 000 FCFA
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Spécialement optimisé pour sécuriser les petits et moyens budgets avec des cotes régulières sans risque d'effondrement de solde.
              </p>
            </div>

            {/* Price */}
            <div className="mb-6 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white font-mono tabular-nums">
                {vipPlans.VIP1.price}
              </span>
              <span className="text-lg font-bold text-slate-400 font-mono">FCFA</span>
              <span className="text-xs text-slate-500 ml-2">/ Paiement unique</span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-6 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Plage Cotes :</span>
                <span className="font-mono font-bold text-white">{vipPlans.VIP1.multiplierRange}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Taux Précision :</span>
                <span className="font-mono font-bold text-emerald-400">{vipPlans.VIP1.successRate}</span>
              </div>
            </div>

            {/* Features list */}
            <ul className="space-y-3 mb-8 text-xs text-slate-300">
              {vipPlans.VIP1.features.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            {/* CTA Action */}
            <button
              onClick={() => handleAction('VIP1')}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <span>
                {currentUser?.paymentStatus === 'paid' && currentUser.vipTier === 'VIP1'
                  ? 'Voir Mon Accès VIP 1'
                  : `Réserver & Payer le VIP 1 (${vipPlans.VIP1.price} F)`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* VIP 2 */}
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-amber-500/40 p-8 shadow-xl shadow-amber-950/20 flex flex-col justify-between">
            {/* Top quota bar */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
                  Formule 2
                </span>
                <h3 className="text-2xl font-bold text-white mt-0.5">VIP 2</h3>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-slate-400">Places disponibles</div>
                <div className="text-sm font-bold font-mono text-amber-400">
                  {vipPlans.VIP2.availableSeats} places disponibles
                </div>
              </div>
            </div>

            {/* Target Capital - Explicitly highlighted */}
            <div className="my-6 p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                Capital Joueur Recommandé
              </div>
              <div className="text-lg font-bold text-white mt-1">
                De 50 000 FCFA jusqu'à 100 000 FCFA
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Conçu pour les gros comptes cherchant à encaisser des multiplicateurs explosifs (3.50x à 15.00x+) avec signaux VIP haute intensité.
              </p>
            </div>

            {/* Price */}
            <div className="mb-6 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white font-mono tabular-nums">
                {vipPlans.VIP2.price}
              </span>
              <span className="text-lg font-bold text-slate-400 font-mono">FCFA</span>
              <span className="text-xs text-slate-500 ml-2">/ Paiement unique</span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-6 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Plage Cotes :</span>
                <span className="font-mono font-bold text-white">{vipPlans.VIP2.multiplierRange}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Taux Précision :</span>
                <span className="font-mono font-bold text-emerald-400">{vipPlans.VIP2.successRate}</span>
              </div>
            </div>

            {/* Features list */}
            <ul className="space-y-3 mb-8 text-xs text-slate-300">
              {vipPlans.VIP2.features.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            {/* CTA Action */}
            <button
              onClick={() => handleAction('VIP2')}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <span>
                {currentUser?.paymentStatus === 'paid' && currentUser.vipTier === 'VIP2'
                  ? 'Voir Mon Accès VIP 2'
                  : `Réserver & Payer le VIP 2 (${vipPlans.VIP2.price} F)`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
