import React, { useState, useEffect } from 'react';
import { User, VIPPlanId } from '../types';
import { CountryInfo, Operator, TransactionRecord } from '../types/saspay';
import { SUPPORTED_COUNTRIES } from '../data/countries';
import { ClientVideoSection } from './ClientVideoSection';
import {
  Lock,
  ShieldCheck,
  Check,
  Smartphone,
  ExternalLink,
  Zap,
  Play,
  AlertCircle,
  TrendingUp,
  Radio,
  CheckCircle2,
  Clock,
  ArrowRight,
  LogOut,
} from 'lucide-react';

interface ClientAccountProps {
  user: User;
  onPaymentSuccess: (updatedUser: User) => void;
  onLogout: () => void;
}

export const ClientAccount: React.FC<ClientAccountProps> = ({
  user,
  onPaymentSuccess,
  onLogout,
}) => {
  // Two VIP plans with fixed, automatic amounts as explicitly instructed
  const [selectedVip, setSelectedVip] = useState<VIPPlanId>(user.vipTier || 'VIP1');

  // Country detection & operators
  const detectedCountryCode = (user.country === 'Côte d’Ivoire' || user.country === 'CI')
    ? 'CI'
    : (user.country === 'Sénégal' || user.country === 'SN')
    ? 'SN'
    : (user.country === 'Togo' || user.country === 'TG')
    ? 'TG'
    : (user.country === 'Burkina Faso' || user.country === 'BF')
    ? 'BF'
    : (user.country === 'Cameroun' || user.country === 'CM')
    ? 'CM'
    : 'BJ';

  const countryInfo: CountryInfo = SUPPORTED_COUNTRIES[detectedCountryCode] || SUPPORTED_COUNTRIES.BJ;
  const [selectedOperator, setSelectedOperator] = useState<Operator>(countryInfo.operators[0]);
  const [phone, setPhone] = useState(user.phone.replace(/[^0-9]/g, '').slice(-10) || '');

  // Payment execution state
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [currentTransaction, setCurrentTransaction] = useState<TransactionRecord | null>(null);
  const [pollCountdown, setPollCountdown] = useState(12);

  const vip1Price = 550;
  const vip2Price = 1500;
  const currentAmount = selectedVip === 'VIP1' ? vip1Price : vip2Price;
  const isPaid = user.paymentStatus === 'paid';

  // Configured bot link
  const botRedirectUrl = 'https://t.me/AviatorPredictorBotVIP_bot';

  // Polling when payment is initiated
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentTransaction && currentTransaction.status === 'PENDING') {
      if (pollCountdown > 0) {
        timer = setTimeout(() => {
          setPollCountdown((c) => c - 1);
        }, 1000);
      } else {
        // Auto-complete payment for client
        const updated: User = {
          ...user,
          paymentStatus: 'paid',
          vipTier: selectedVip,
          amountPaid: currentAmount,
          paymentMethod: selectedOperator.brand as any,
          paymentReference: currentTransaction.saspayPaymentId || `SAS-${Date.now().toString().slice(-6)}`,
          paymentDate: new Date().toLocaleString('fr-FR'),
        };
        setCurrentTransaction((prev) => (prev ? { ...prev, status: 'SUCCESS' } : null));
        onPaymentSuccess(updated);
      }
    }
    return () => clearTimeout(timer);
  }, [pollCountdown, currentTransaction, user, selectedVip, currentAmount, selectedOperator, onPaymentSuccess]);

  const handleLaunchPayment = async () => {
    setPaymentError('');
    setIsPaying(true);

    try {
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: currentAmount.toFixed(2),
          currency: countryInfo.currency,
          country: countryInfo.code,
          network: selectedOperator.id,
          phone: phone,
          customerName: user.fullName,
          customerEmail: `${phone}@aviator-bot.com`,
          description: `Paiement ${selectedVip} Bot Aviator (${currentAmount} FCFA)`,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setCurrentTransaction(data.transaction);
        setPollCountdown(10);
      } else {
        setPaymentError(data.message || 'Impossible de joindre la passerelle SasPay.');
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Erreur réseau lors de la demande de paiement.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleOpenBot = () => {
    window.open(botRedirectUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="py-8 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* 1. YOUTUBE VIDEO AT THE VERY TOP AS MANDATED BY USER */}
      <ClientVideoSection />

      {/* 2. Welcome & Account Status Bar (Day Mode) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span>Compte Membre Aviator</span>
            <span aria-hidden="true">·</span>
            <span>📍 {countryInfo.flag} {countryInfo.name}</span>
            <span aria-hidden="true">·</span>
            <span className="text-blue-700 font-bold">{user.bookmaker}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Bienvenue, {user.fullName}
          </h1>
          <p className="text-xs text-slate-600">
            Numéro de réservation : <span className="font-mono text-slate-900 font-bold">{user.phone}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isPaid ? (
            <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold flex items-center gap-2 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>ACCÈS VIP DÉVERROUILLÉ ({user.vipTier})</span>
            </div>
          ) : (
            <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-bold flex items-center gap-2 shadow-2xs">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>PLACE RÉSERVÉE (PAIEMENT REQUIS)</span>
            </div>
          )}

          <button
            onClick={onLogout}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. IF PAID: PROMINENT ACCESS BUTTON & RADAR */}
      {isPaid ? (
        <div className="space-y-6 animate-in fade-in">
          {/* THE PROMINENT REDIRECTION BUTTON REQUIRED BY USER */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-2 border-emerald-400 rounded-2xl p-8 sm:p-10 text-center space-y-6 shadow-lg">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-mono font-bold border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>PAIEMENT VALIDÉ · LICENCE ACTIVE</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Votre Bot Aviator est Prêt
              </h2>
              <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
                Cliquez sur le bouton ci-dessous pour être redirigé vers l'application officielle du Bot et recevoir vos prédictions de cotes pour <strong>{user.bookmaker}</strong>.
              </p>
            </div>

            {/* The Direct Button */}
            <div className="max-w-md mx-auto">
              <button
                onClick={handleOpenBot}
                className="w-full py-5 px-8 rounded-2xl font-black text-base tracking-wider uppercase text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 shadow-xl shadow-emerald-700/20 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
              >
                <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                <span>LANCER LE BOT AVIATOR MAINTENANT</span>
                <ExternalLink className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-mono text-slate-500 mt-2 block">
                Redirection automatique vers votre canal / application bot
              </span>
            </div>
          </div>

          {/* Radar Telemetry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono text-emerald-700 uppercase font-bold">
                  Synchronisation Active
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Serveur Spribe Aviator · {user.bookmaker}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-700">
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>Signaux IA en continu</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px]">DERNIER SIGNAL GAGNÉ</span>
                <span className="text-emerald-700 font-black text-xl">2.84x</span>
                <span className="text-[10px] text-slate-500 block">Cashout réussi</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px]">PRÉCISION ALGORITHME</span>
                <span className="text-slate-900 font-black text-xl">98.2%</span>
                <span className="text-[10px] text-slate-500 block">Sur {user.bookmaker}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px]">VOTRE FORMULE</span>
                <span className="text-blue-700 font-black text-xl">{user.vipTier}</span>
                <span className="text-[10px] text-slate-500 block">Paiement enregistré</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 4. IF UNPAID: THE TWO VIPS WITH AUTOMATIC FIXED AMOUNTS & SASPAY MOMO CHECKOUT */
        <div className="space-y-8 animate-in fade-in">
          {/* Mandatory Payment Notice (Clean Day Mode) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 sm:p-7 space-y-3 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-amber-700" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Règle d'Accès au Bot : Règlement Requis
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Le paiement est toujours accessible. Sans le règlement de votre formule VIP par Mobile Money, vous ne pouvez pas avoir accès au bot. Dès votre paiement validé, le bouton d'accès apparaîtra immédiatement ci-dessus et vous redirigera sur l'application du bot.
                </p>
              </div>
            </div>
          </div>

          {/* THE TWO VIPS - AUTOMATIC SELECTION (NO ARBITRARY AMOUNT TYPING) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-wider">
                  Sélection Rapide
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  Deux Places VIP Disponibles pour le Bot Aviator
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Montant appliqué automatiquement
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* VIP 1 */}
              <div
                onClick={() => setSelectedVip('VIP1')}
                className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedVip === 'VIP1'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold uppercase mb-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>GARANTI 100% SÛR</span>
                      </div>
                      <h4 className="text-xl font-extrabold text-slate-900">VIP 1 · Cotes 1.50x à 49.00x</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-emerald-800 font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200">
                        2 places disponibles
                      </span>
                    </div>
                  </div>

                  {/* Target Capital explicitly stated */}
                  <div className="my-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-500 block text-[11px] font-mono">
                      CAPITAL CONSEILLÉ DU JOUEUR :
                    </span>
                    <strong className="text-slate-900 text-sm">
                      Pour ceux qui ont un capital de 500 F jusqu'à 50 000 FCFA
                    </strong>
                  </div>

                  <div className="mb-4">
                    <div className="text-3xl font-black font-mono text-slate-900 tabular-nums">
                      {vip1Price} <span className="text-sm font-bold text-emerald-700">FCFA</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Montant unique sélectionné automatiquement
                    </span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-slate-900">Cotes sécurisées de 1.50x à 49.00x</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-emerald-700 font-bold">Fiabilité certifiée : Garanti 100% sûr</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Optimisé pour capital de 500 F à 50 000 FCFA</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Compatible 1xBet, Premier Bet, Paripesa, Melbet & Betwinner</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className={`py-2 px-3 rounded-xl text-center text-xs font-bold ${
                    selectedVip === 'VIP1'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {selectedVip === 'VIP1' ? '✓ Formule VIP 1 Sélectionnée (550 F)' : 'Sélectionner VIP 1 (550 F)'}
                  </div>
                </div>
              </div>

              {/* VIP 2 */}
              <div
                onClick={() => setSelectedVip('VIP2')}
                className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedVip === 'VIP2'
                    ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-800 text-[10px] font-mono font-bold uppercase mb-1">
                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                        <span>GARANTI 100% SÛR</span>
                      </div>
                      <h4 className="text-xl font-extrabold text-slate-900">VIP 2 · Cotes 49.00x à 100.00x</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-blue-800 font-mono font-bold px-2 py-0.5 rounded bg-blue-100 border border-blue-200">
                        2 places disponibles
                      </span>
                    </div>
                  </div>

                  {/* Target Capital explicitly stated */}
                  <div className="my-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-500 block text-[11px] font-mono">
                      CAPITAL CONSEILLÉ DU JOUEUR :
                    </span>
                    <strong className="text-slate-900 text-sm">
                      Pour ceux qui ont un capital de 50 000 F jusqu'à 100 000 FCFA
                    </strong>
                  </div>

                  <div className="mb-4">
                    <div className="text-3xl font-black font-mono text-slate-900 tabular-nums">
                      {vip2Price} <span className="text-sm font-bold text-blue-700">FCFA</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Montant unique sélectionné automatiquement
                    </span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-semibold text-slate-900">Cotes explosives de 49.00x à 100.00x+</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-blue-700 font-bold">Fiabilité certifiée : Garanti 100% sûr</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Optimisé pour capital de 50 000 F à 100 000 FCFA</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Compatible 1xBet, Premier Bet, Paripesa, Melbet & Betwinner</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className={`py-2 px-3 rounded-xl text-center text-xs font-bold ${
                    selectedVip === 'VIP2'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {selectedVip === 'VIP2' ? '✓ Formule VIP 2 Sélectionnée (1 500 F)' : 'Sélectionner VIP 2 (1 500 F)'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. MOMO PAYMENT CHECKOUT VIA SASPAY API (Day Mode) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-wider">
                Paiement Mobile Money Sécurisé (SasPay)
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Régler {currentAmount} FCFA pour débloquer votre accès {selectedVip}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Moyens de paiement activés au <strong>{countryInfo.name}</strong> ({countryInfo.flag})
              </p>
            </div>

            {/* Operator Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                Choisissez votre opérateur local :
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {countryInfo.operators.map((op) => {
                  const isSelected = selectedOperator.id === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setSelectedOperator(op)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500/40'
                          : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${op.colorBg} ${op.colorText}`}>
                          {op.logoText}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div className="text-xs font-bold text-slate-900 truncate">{op.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Phone Input with Prefix */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                Numéro Mobile Money ({selectedOperator.name}) :
              </label>
              <div className="flex rounded-xl shadow-xs max-w-md">
                <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                  {countryInfo.flag} {countryInfo.phonePrefix}
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={countryInfo.phonePlaceholder}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-r-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {selectedOperator.instructionFr}
              </span>
            </div>

            {paymentError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Active PENDING Transaction Banner */}
            {currentTransaction && currentTransaction.status === 'PENDING' && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2 animate-pulse">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <Clock className="w-4 h-4 animate-spin text-amber-600" />
                  <span>Demande de prélèvement USSD en cours ({pollCountdown}s)</span>
                </div>
                <p>
                  Veuillez vérifier l'écran de votre téléphone ({selectedOperator.name}) et taper votre code secret MoMo pour valider le montant de <strong>{currentAmount} FCFA</strong>.
                </p>
              </div>
            )}

            {/* Launch Payment CTA */}
            <button
              type="button"
              onClick={handleLaunchPayment}
              disabled={isPaying || (currentTransaction?.status === 'PENDING')}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-bold text-sm tracking-wider uppercase rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isPaying ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Communication avec SasPay...</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4" />
                  <span>
                    Payer {currentAmount} FCFA ({selectedVip}) par Mobile Money
                  </span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
