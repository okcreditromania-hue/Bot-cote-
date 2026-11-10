import React, { useState } from 'react';
import { User, VIPPlanId, LiveSignal } from '../types';
import { StorageService, INITIAL_SIGNALS, WEST_AFRICA_BOOKMAKERS } from '../services/storage';
import {
  ShieldCheck,
  Lock,
  ExternalLink,
  Zap,
  Smartphone,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Play,
  KeyRound,
  Radio,
  CheckCircle,
} from 'lucide-react';

interface UserDashboardProps {
  user: User;
  onOpenPayment: (vipTier: VIPPlanId) => void;
  onRefreshUser: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  user,
  onOpenPayment,
  onRefreshUser,
}) => {
  const vipPlans = StorageService.getVipPlans();
  const adminSettings = StorageService.getAdminSettings();
  const [activeTab, setActiveTab] = useState<'status' | 'signals' | 'tuto'>('status');
  const [signals, setSignals] = useState<LiveSignal[]>(INITIAL_SIGNALS);

  const isPaid = user.paymentStatus === 'paid';
  const currentPlan = vipPlans[user.vipTier || 'VIP1'];

  const bookmakerInfo =
    WEST_AFRICA_BOOKMAKERS.find(
      (b) => b.name.toLowerCase() === (user.bookmaker || '').toLowerCase()
    ) || WEST_AFRICA_BOOKMAKERS[0];

  const handleLaunchBot = () => {
    const url = adminSettings.botRedirectUrl || 'https://t.me/AviatorPredictorBotVIP_bot';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="py-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Welcome Card */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">
                Compte N° {user.id.slice(-6).toUpperCase()}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs text-slate-300 flex items-center gap-1">
                📍 {user.country}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs font-medium text-rose-400">
                {user.bookmaker} (Aviator)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Bonjour, {user.fullName}
            </h1>

            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              {isPaid ? (
                <span className="text-emerald-400 font-medium">
                  Votre place est confirmée et votre accès VIP au Bot Aviator est déverrouillé !
                </span>
              ) : (
                <span>
                  Votre inscription a bien réservé votre place dans le compte. Veuillez finaliser votre paiement Mobile Money pour accéder immédiatement au bot.
                </span>
              )}
            </p>
          </div>

          {/* Status Badge & Quick Action */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {isPaid ? (
              <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>VIP ACTIF · {user.vipTier}</span>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>PLACE RÉSERVÉE (NON PAYÉ)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Switcher: If Paid vs Unpaid */}
      {!isPaid ? (
        /* ================= UNPAID STATE ================= */
        <div className="space-y-8">
          {/* Explicit payment mandatory banner as requested */}
          <div className="rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-950/40 border border-rose-500/40 p-6 sm:p-8 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">
                  Paiement obligatoire pour débloquer le Bot Aviator
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                  Le paiement est toujours accessible. Sans le règlement de votre formule VIP par Mobile Money (MoMo), vous ne pouvez pas avoir accès à l'application du bot. Dès votre paiement validé, un bouton direct s'affichera ici et vous redirigera immédiatement vers le bot officiel.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-4">
              <button
                onClick={() => onOpenPayment(user.vipTier || 'VIP1')}
                className="py-3.5 px-6 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-xl shadow-rose-950/50 flex items-center gap-2 transition-all active:scale-[0.99]"
              >
                <Smartphone className="w-4 h-4" />
                <span>Payer maintenant par Mobile Money ({currentPlan.price} FCFA)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rappel des deux places VIP disponibles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Deux places de VIP disponibles pour le jeu Casino Aviator
              </h3>
              <span className="text-xs font-mono text-rose-400">
                Quota limité à 2 places
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* VIP 1 */}
              <div
                className={`rounded-2xl p-6 border transition-all ${
                  user.vipTier === 'VIP1'
                    ? 'bg-slate-900 border-rose-500 ring-1 ring-rose-500/40'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-mono text-rose-400 font-bold uppercase">
                      VIP 1 · 550 FCFA
                    </span>
                    <h4 className="text-lg font-bold text-white">Formule Sécurisée</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono font-bold">
                    {vipPlans.VIP1.availableSeats} places dispo
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 mb-4 text-xs">
                  <div className="text-slate-400 font-mono">Capital Joueur :</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    Pour ceux qui ont un capital de 500 F jusqu'à 50 000 FCFA
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  Idéal pour débuter sans risque d'échec sur {user.bookmaker}. Multiplicateurs modérés 1.50x à 2.90x avec encaissement automatique garanti.
                </p>

                <button
                  onClick={() => onOpenPayment('VIP1')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Prendre le VIP 1 (550 FCFA)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* VIP 2 */}
              <div
                className={`rounded-2xl p-6 border transition-all ${
                  user.vipTier === 'VIP2'
                    ? 'bg-slate-900 border-amber-500 ring-1 ring-amber-500/40'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-mono text-amber-400 font-bold uppercase">
                      VIP 2 · {vipPlans.VIP2.price} FCFA
                    </span>
                    <h4 className="text-lg font-bold text-white">Formule Haute Rentabilité</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold">
                    {vipPlans.VIP2.availableSeats} places dispo
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 mb-4 text-xs">
                  <div className="text-slate-400 font-mono">Capital Joueur :</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    Pour ceux qui ont un capital de 50 000 F jusqu'à 100 000 FCFA
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  Conçu pour les parieurs avec un capital important. Détection des pics roses et cotes supérieures à 15.00x sur tous les bookmakers partenaires.
                </p>

                <button
                  onClick={() => onOpenPayment('VIP2')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Prendre le VIP 2 ({vipPlans.VIP2.price} FCFA)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= PAID VIP STATE (BOT UNLOCKED) ================= */
        <div className="space-y-8">
          {/* THE PROMINENT BOT BUTTON REQUIRED BY USER */}
          <div className="rounded-2xl bg-gradient-to-r from-rose-900/40 via-red-950/60 to-slate-900 border-2 border-rose-500/60 p-6 sm:p-10 text-center space-y-6 shadow-2xl shadow-rose-950/50">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
              <CheckCircle className="w-3.5 h-3.5" />
              PAIEMENT CONFIRMÉ ({user.paymentReference || 'MOMO-OK'})
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Accès au Bot Aviator Débloqué
              </h2>
              <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                Cliquez sur le bouton ci-dessous pour être redirigé directement vers votre application de bot pour <strong>{user.bookmaker}</strong>.
              </p>
            </div>

            {/* THE REDIRECTION BUTTON */}
            <div className="max-w-md mx-auto">
              <button
                onClick={handleLaunchBot}
                className="w-full py-5 px-8 rounded-2xl font-black text-sm sm:text-base tracking-wider uppercase text-white bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 shadow-2xl shadow-rose-600/40 hover:shadow-rose-600/60 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:translate-y-0 group"
              >
                <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                <span>LANCER LE BOT AVIATOR MAINTENANT</span>
                <ExternalLink className="w-5 h-5" />
              </button>
              <div className="text-[11px] text-slate-400 mt-2 font-mono">
                Redirection sécurisée vers {adminSettings.botTitle}
              </div>
            </div>
          </div>

          {/* Telemetry & Flight Simulator Visual Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Screen */}
            <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                    Radar Prédictif En Direct
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Télémétrie Cotes Spribe · {user.bookmaker}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-rose-500" />
                  <span>Synchronisé</span>
                </div>
              </div>

              {/* Radar Image Container */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 aspect-video bg-slate-950">
                <img
                  src="/src/assets/images/aviator_radar_screen_1794330398698.jpg"
                  alt="Radar Aviator Bot VIP"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/20 pointer-events-none" />

                {/* Floating telemetry metrics on overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs font-mono text-white bg-slate-950/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 text-[10px] block">PROCHAIN SIGNAL</span>
                    <span className="text-rose-400 font-bold text-sm">2.45x - 3.80x</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">CASHOUT CONSEILLÉ</span>
                    <span className="text-emerald-400 font-bold text-sm">2.10x</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">PRÉCISION</span>
                    <span className="text-white font-bold text-sm">98.5%</span>
                  </div>
                </div>
              </div>

              {/* Bookmaker reminder */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Plateforme connectée :</span>
                <span className="font-bold text-white">{user.bookmaker} ({bookmakerInfo.badge})</span>
              </div>
            </div>

            {/* Sidebar Live Signals */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-rose-500" />
                  Signaux Récents
                </h4>
                <span className="text-[11px] font-mono text-slate-400">Temps réel</span>
              </div>

              <div className="space-y-3">
                {signals.map((sig) => (
                  <div
                    key={sig.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{sig.game}</span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                          sig.status === 'ACTIVE'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : sig.status === 'WON'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {sig.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="text-slate-400">Cote Prévue :</span>
                      <span className="text-white font-bold">{sig.predictedMultiplier}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Cashout Sûr :</span>
                      <span className="text-emerald-400">{sig.safetyCashout}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleLaunchBot}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ouvrir l'application du bot</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
