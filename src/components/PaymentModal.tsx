import React, { useState, useEffect } from 'react';
import { VIPPlanId, MomoProvider, User } from '../types';
import { StorageService } from '../services/storage';
import { MomoGateway } from '../services/momoGateway';
import {
  X,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  user: User;
  vipTier: VIPPlanId;
  onClose: () => void;
  onPaymentSuccess: (updatedUser: User) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  user,
  vipTier,
  onClose,
  onPaymentSuccess,
}) => {
  const vipPlans = StorageService.getVipPlans();
  const adminSettings = StorageService.getAdminSettings();
  const currentPlan = vipPlans[vipTier];

  const [provider, setProvider] = useState<MomoProvider>('MTN');
  const [phone, setPhone] = useState(user.phone || '');
  const [manualRef, setManualRef] = useState('');
  const [activeMode, setActiveMode] = useState<'auto' | 'manual'>('auto');

  // Simulation state
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'idle' | 'push_sent' | 'waiting_pin' | 'confirmed'>('idle');
  const [countdown, setCountdown] = useState(8);
  const [error, setError] = useState('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'push_sent' || step === 'waiting_pin') {
      if (countdown > 0) {
        timer = setTimeout(() => {
          setCountdown((c) => c - 1);
          if (countdown === 5) setStep('waiting_pin');
        }, 1000);
      } else {
        // Validation automatique réussie
        setStep('confirmed');
        const updated = StorageService.updateUserPayment(
          user.id,
          'paid',
          provider,
          `MOMO-${provider}-${Date.now().toString().slice(-6)}`
        );
        if (updated) {
          setTimeout(() => {
            onPaymentSuccess(updated);
          }, 1200);
        }
      }
    }
    return () => clearTimeout(timer);
  }, [countdown, step, user.id, provider, onPaymentSuccess]);

  if (!isOpen) return null;

  const handleStartAutoDebit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || phone.length < 8) {
      setError('Veuillez renseigner un numéro de téléphone valide.');
      return;
    }

    setIsProcessing(true);
    setStep('push_sent');
    setCountdown(8);

    // Appel à la passerelle MomoGateway (prête pour API utilisateur)
    await MomoGateway.requestToPay({
      userId: user.id,
      phone,
      amount: currentPlan.price,
      provider,
      vipTier,
      customerName: user.fullName,
    });
  };

  const handleManualVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRef.trim()) {
      setError('Veuillez entrer le code de référence de la transaction.');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      const updated = StorageService.updateUserPayment(
        user.id,
        'paid',
        provider,
        manualRef.trim()
      );
      if (updated) {
        setStep('confirmed');
        setTimeout(() => {
          onPaymentSuccess(updated);
        }, 1000);
      }
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                Paiement Mobile Money
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  Sécurisé
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {currentPlan.name} · {currentPlan.price} FCFA
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing && step !== 'confirmed'}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formel Warning banner */}
        <div className="px-6 py-2.5 bg-amber-950/30 border-b border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>
            Le paiement est toujours accessible. Sans ce règlement, le bouton du bot ne peut être débloqué.
          </span>
        </div>

        {/* Step: Confirmed Success */}
        {step === 'confirmed' ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                Paiement validé avec succès !
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                Votre place pour le <strong>{currentPlan.name}</strong> est maintenant confirmée. Le bouton d'accès au Bot Aviator vient d'être déverrouillé.
              </p>
            </div>
            <div className="text-xs text-emerald-400 font-mono">
              Redirection automatique vers votre espace...
            </div>
          </div>
        ) : step === 'push_sent' || step === 'waiting_pin' ? (
          /* Step: Waiting USSD Push confirmation */
          <div className="p-8 text-center space-y-5">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-rose-500 animate-spin" />
              <div className="w-14 h-14 rounded-full bg-slate-950 flex items-center justify-center text-white font-mono font-bold text-lg">
                {countdown}s
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-base font-bold text-white">
                {step === 'push_sent'
                  ? 'Notification de débit envoyée !'
                  : 'En attente de validation sur votre téléphone...'}
              </div>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Une notification USSD a été transmise sur le numéro{' '}
                <strong className="text-white font-mono">{phone}</strong> ({provider}).
                Veuillez taper votre code secret Mobile Money pour autoriser le prélèvement de{' '}
                <strong className="text-rose-400 font-mono">{currentPlan.price} FCFA</strong>.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 max-w-sm mx-auto flex items-center justify-center gap-2">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              <span>Prélèvement automatique par passerelle MoMo</span>
            </div>
          </div>
        ) : (
          /* Step: Form Input */
          <div className="p-6 space-y-5">
            {/* Mode selection tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveMode('auto')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeMode === 'auto'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Prélèvement Automatique (Recommandé)
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('manual')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeMode === 'manual'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Code de Transaction
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Operator selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Choisissez votre opérateur Mobile Money
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['MTN', 'ORANGE', 'MOOV', 'WAVE'] as MomoProvider[]).map((prov) => (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setProvider(prov)}
                    className={`py-2 px-1 rounded-xl border text-center transition-all ${
                      provider === prov
                        ? 'border-rose-500 bg-rose-500/15 shadow-sm ring-1 ring-rose-500/50'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{prov}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {prov === 'MTN'
                        ? 'MoMo'
                        : prov === 'ORANGE'
                        ? 'Money'
                        : prov === 'MOOV'
                        ? 'Flooz'
                        : 'Wave'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {activeMode === 'auto' ? (
              <form onSubmit={handleStartAutoDebit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Numéro à prélever ({provider})
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: +229 97 00 00 00"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Vous recevrez un message de confirmation USSD sur votre écran pour valider le code secret.
                  </span>
                </div>

                {/* Recap amount */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Montant à régler :</span>
                    <div className="text-xs font-semibold text-white">
                      Accès {currentPlan.name}
                    </div>
                  </div>
                  <div className="text-lg font-bold font-mono text-rose-400 tabular-nums">
                    {currentPlan.price} FCFA
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Lancer le prélèvement automatique MoMo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleManualVerification} className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-white">
                    Numéro marchand de réception :
                  </div>
                  <div className="font-mono text-amber-400 text-sm">
                    {adminSettings.momoConfig.merchantPhone} ({adminSettings.momoConfig.merchantName})
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Faites un transfert de <strong>{currentPlan.price} FCFA</strong> vers ce numéro puis collez l'ID de transaction reçu par SMS ci-dessous.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Référence de transaction MoMo
                  </label>
                  <input
                    type="text"
                    required
                    value={manualRef}
                    onChange={(e) => setManualRef(e.target.value)}
                    placeholder="Ex: TX-984021 ou 202611100987"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Vérifier et débloquer mon bot</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
