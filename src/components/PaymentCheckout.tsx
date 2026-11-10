import React, { useState, useEffect } from 'react';
import { CountryInfo, Operator, OperatorId, TransactionRecord } from '../types/saspay';
import {
  Smartphone,
  Lock,
  ShieldCheck,
  ArrowRight,
  Check,
  AlertCircle,
  Sparkles,
  Info,
} from 'lucide-react';

interface PaymentCheckoutProps {
  country: CountryInfo;
  onPaymentInitiated: (transaction: TransactionRecord) => void;
}

export const PaymentCheckout: React.FC<PaymentCheckoutProps> = ({
  country,
  onPaymentInitiated,
}) => {
  const [selectedOperator, setSelectedOperator] = useState<Operator>(country.operators[0]);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('2500');
  const [customerName, setCustomerName] = useState('Awa Koné');
  const [customerEmail, setCustomerEmail] = useState('awa.kone@gmail.com');
  const [description, setDescription] = useState('Encaissement Client Mobile Money');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Update operator when country changes
  useEffect(() => {
    if (country.operators.length > 0) {
      setSelectedOperator(country.operators[0]);
    }
  }, [country]);

  const quickAmounts = [1000, 2500, 5000, 10000, 25000, 50000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < selectedOperator.minAmount) {
      setErrorMessage(
        `Le montant minimum pour ${selectedOperator.name} est de ${selectedOperator.minAmount} ${country.currency}.`
      );
      return;
    }

    if (!phone || phone.replace(/\s+/g, '').length < 6) {
      setErrorMessage('Veuillez saisir un numéro de téléphone valide.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: numAmount.toFixed(2),
          currency: country.currency,
          country: country.code,
          network: selectedOperator.id,
          phone,
          customerName,
          customerEmail,
          description,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onPaymentInitiated(data.transaction);
      } else {
        setErrorMessage(data.message || 'Impossible d’initier le paiement SasPay.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de connexion avec le serveur SasPay.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Intro Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>SasPay Direct API · Sécurité Bancaire & MoMo</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Encaissement Mobile Money
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Paiement direct et prélèvement automatique instantané sur votre compte Mobile Money au{' '}
          <strong>{country.name}</strong> ({country.flag}).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Payment Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Operator Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span>Choisissez l'opérateur ({country.name})</span>
                </label>
                <span className="text-xs text-slate-400">
                  {country.operators.length} disponibles
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {country.operators.map((op) => {
                  const isSelected = selectedOperator.id === op.id;
                  return (
                    <div
                      key={op.id}
                      onClick={() => setSelectedOperator(op)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${op.colorBg} ${op.colorText}`}
                        >
                          {op.logoText}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{op.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Min: {op.minAmount.toLocaleString()} {country.currency}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Operator hint instruction */}
              <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{selectedOperator.instructionFr}</span>
              </div>
            </div>

            {/* Step 2: Phone Number Input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                <span>Numéro de téléphone ({selectedOperator.name})</span>
              </label>

              <div className="flex rounded-xl shadow-2xs">
                <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-slate-700 text-sm font-mono font-bold">
                  {country.flag} {country.phonePrefix}
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={country.phonePlaceholder}
                  className="w-full px-4 py-3 border border-slate-300 rounded-r-xl text-base font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Saisissez le numéro sans l'indicatif. Exemple : {country.phonePlaceholder}
              </span>
            </div>

            {/* Step 3: Amount Selection */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                  3
                </span>
                <span>Montant à encaisser ({country.currency})</span>
              </label>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(q.toString())}
                    className={`py-2 px-1 text-xs font-mono font-semibold rounded-lg border transition-all ${
                      amount === q.toString()
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {q.toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="number"
                  required
                  min={selectedOperator.minAmount}
                  max={selectedOperator.maxAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-slate-400">
                  {country.currency}
                </span>
              </div>
            </div>

            {/* Step 4: Customer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom du client
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Jean Mensah"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email du client
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="client@domaine.com"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motif / Description du paiement
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Paiement de commande #4829"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-xl font-bold text-sm tracking-wider uppercase text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-75 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Communication avec SasPay...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>
                    Payer {parseFloat(amount || '0').toLocaleString()} {country.currency} via SasPay
                  </span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Recap & Live Security Info */}
        <div className="lg:col-span-5 space-y-6">
          {/* Order Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 pb-3 border-b border-slate-100 flex items-center justify-between">
              <span>Récapitulatif de transaction</span>
              <span className="text-xs font-mono text-emerald-700 font-bold">SasPay v1</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Pays récepteur :</span>
                <span className="font-semibold text-slate-900 flex items-center gap-1">
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-500">Réseau Mobile :</span>
                <span className="font-semibold text-slate-900">{selectedOperator.name}</span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-500">Téléphone client :</span>
                <span className="font-mono font-semibold text-slate-900">
                  {country.phonePrefix} {phone || '...'}
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-500">Frais de passerelle :</span>
                <span className="font-semibold text-emerald-600">0 % (Inclus)</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900">Total à débiter :</span>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-emerald-600 tabular-nums">
                    {parseFloat(amount || '0').toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-slate-500 ml-1">
                    {country.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SasPay Architecture & Trust */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-2xl p-6 text-white space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>TECHNOLOGIE SASPAY CONNECT</span>
            </div>

            <h4 className="text-base font-bold">
              Traitement Sécurisé Côté Serveur
            </h4>

            <p className="text-xs text-slate-300 leading-relaxed">
              Vos clés secrètes API SasPay sont strictement sécurisées sur le serveur avec chiffrement TLS et envoi du header <code>Idempotency-Key</code> pour éliminer tout risque de double débit.
            </p>

            <div className="pt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono">
              <div className="p-2 rounded-lg bg-white/10">
                ✓ Softpay Direct Push
              </div>
              <div className="p-2 rounded-lg bg-white/10">
                ✓ 6 Pays Activés
              </div>
              <div className="p-2 rounded-lg bg-white/10">
                ✓ Webhook Sync
              </div>
              <div className="p-2 rounded-lg bg-white/10">
                ✓ Devises XOF & XAF
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
