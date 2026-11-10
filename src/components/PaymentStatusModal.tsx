import React, { useState, useEffect } from 'react';
import { TransactionRecord, PaymentStatus } from '../types/saspay';
import {
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Smartphone,
  Download,
  RotateCcw,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface PaymentStatusModalProps {
  transaction: TransactionRecord | null;
  onClose: () => void;
  onRefreshList?: () => void;
}

export const PaymentStatusModal: React.FC<PaymentStatusModalProps> = ({
  transaction,
  onClose,
  onRefreshList,
}) => {
  const [currentTx, setCurrentTx] = useState<TransactionRecord | null>(transaction);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    setCurrentTx(transaction);
  }, [transaction]);

  // Polling verification every 2.5 seconds if PENDING
  useEffect(() => {
    if (!currentTx || currentTx.status !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/payments/${currentTx.id}/verify`);
        const data = await response.json();
        if (data.success && data.transaction) {
          setCurrentTx(data.transaction);
          if (data.transaction.status !== 'PENDING') {
            if (onRefreshList) onRefreshList();
          }
        }
      } catch (e) {
        console.error('Erreur verify poll:', e);
      }
      setPollCount((p) => p + 1);
    }, 2500);

    return () => clearInterval(interval);
  }, [currentTx, onRefreshList]);

  if (!currentTx) return null;

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900">
              Statut de Paiement SasPay
            </span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
              {currentTx.country} · {currentTx.operatorBrand}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content based on status */}
        <div className="p-6 sm:p-8 space-y-6">
          {currentTx.status === 'PENDING' ? (
            /* ================= PENDING STATUS ================= */
            <div className="text-center space-y-5">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                <Smartphone className="w-8 h-8 text-blue-600 animate-pulse" />
              </div>

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold font-mono border border-amber-200">
                  <Clock className="w-3.5 h-3.5" />
                  EN ATTENTE DE VALIDATION USSD
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-2">
                  Notification envoyée sur votre téléphone
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Une demande de prélèvement de{' '}
                  <strong className="text-slate-900 font-mono">
                    {currentTx.amount.toLocaleString()} {currentTx.currency}
                  </strong>{' '}
                  a été transmise sur le numéro{' '}
                  <strong className="text-slate-900 font-mono">{currentTx.phone}</strong> via{' '}
                  <strong>{currentTx.operatorName}</strong>.
                </p>
              </div>

              {/* Instructions box */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 text-left space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Action requise sur votre mobile :</span>
                </div>
                <p>
                  Veuillez vérifier votre écran et composer votre code secret Mobile Money pour approuver la transaction. La page se mettra à jour automatiquement dès confirmation.
                </p>
              </div>

              <div className="text-[11px] font-mono text-slate-400">
                Synchronisation SasPay API en direct (essai #{pollCount + 1})...
              </div>
            </div>
          ) : currentTx.status === 'SUCCESS' ? (
            /* ================= SUCCESS STATUS ================= */
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold font-mono border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PAIEMENT CONFIRMÉ ET RÉUSSI
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  {currentTx.amount.toLocaleString()} {currentTx.currency}
                </h3>
                <p className="text-xs text-slate-500">
                  Encaissé via {currentTx.operatorName} · Réf SasPay :{' '}
                  <span className="font-mono text-slate-700 font-bold">
                    {currentTx.saspayPaymentId}
                  </span>
                </p>
              </div>

              {/* Formal Receipt Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Client :</span>
                  <span className="font-semibold text-slate-900">{currentTx.customerName}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Téléphone :</span>
                  <span className="font-mono text-slate-900">{currentTx.phone}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Pays :</span>
                  <span className="font-semibold text-slate-900">
                    {currentTx.countryName} ({currentTx.country})
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Date & Heure :</span>
                  <span className="font-mono text-slate-900">
                    {new Date(currentTx.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Motif :</span>
                  <span className="text-slate-900">{currentTx.description}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Imprimer le reçu</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <span>Nouveau paiement</span>
                </button>
              </div>
            </div>
          ) : (
            /* ================= FAILED STATUS ================= */
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-rose-100 border border-rose-300 text-rose-600 flex items-center justify-center mx-auto">
                <XCircle className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-800 text-xs font-bold font-mono border border-rose-200">
                  <XCircle className="w-3.5 h-3.5" />
                  PAIEMENT ÉCHOUÉ
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-2">
                  La transaction n'a pas pu aboutir
                </h3>
                <p className="text-xs text-rose-600 max-w-sm mx-auto">
                  {currentTx.statusMessage || 'Le prélèvement a été annulé ou a expiré.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-left space-y-1">
                <span className="font-semibold text-slate-800">Raisons fréquentes :</span>
                <ul className="list-disc list-inside text-slate-500 space-y-0.5 text-[11px]">
                  <li>Solde Mobile Money insuffisant sur le compte.</li>
                  <li>Délai de saisie du code secret USSD dépassé.</li>
                  <li>Rejet manuel de la demande sur le téléphone.</li>
                </ul>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réessayer un nouveau paiement</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
