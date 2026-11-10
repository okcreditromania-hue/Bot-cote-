import React from 'react';
import { UserCheck, Smartphone, CheckCircle, ExternalLink, ShieldCheck } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Inscription & Réservation de Place',
      desc: 'Renseignez votre numéro Mobile Money et votre casino favori (1xBet, Paripesa, Melbet, Premier Bet). Vous réservez immédiatement l’une des 2 places VIP disponibles.',
      icon: UserCheck,
      badge: 'Sans engagement initial',
    },
    {
      num: '02',
      title: 'Règlement par Mobile Money (MoMo)',
      desc: 'Paiement de 550 FCFA (VIP 1 pour capital de 500 à 50 000 F) ou VIP 2 par MTN MoMo, Orange Money, Moov ou Wave. Sans paiement, aucun accès n’est accordé.',
      icon: Smartphone,
      badge: '550 FCFA (VIP 1)',
    },
    {
      num: '03',
      title: 'Validation & Déverrouillage Automatique',
      desc: 'Dès que le prélèvement ou le code de transaction est validé, votre compte passe au statut VIP Actif.',
      icon: CheckCircle,
      badge: 'Instantané',
    },
    {
      num: '04',
      title: 'Redirection vers l’Application du Bot',
      desc: 'Le bouton officiel s’allume sur votre écran. Un simple clic vous redirige directement sur l’application du bot pour commencer vos sessions gagnantes.',
      icon: ExternalLink,
      badge: 'Accès Direct',
    },
  ];

  return (
    <section id="fonctionnement" className="py-16 border-b border-slate-800/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-rose-400 uppercase tracking-widest mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Processus Étape par Étape
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Comment Fonctionne la Réservation & l'Accès au Bot
          </h2>
          <p className="mt-2 text-sm text-slate-400 text-balance">
            Un parcours simple et fluide conforme aux standards de sécurité bancaire et Mobile Money en Afrique de l'Ouest.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between relative group hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black font-mono text-rose-500/80">
                      {step.num}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-rose-400 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-500">
                  {step.badge}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
