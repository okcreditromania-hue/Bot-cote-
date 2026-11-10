import React from 'react';
import { WEST_AFRICA_BOOKMAKERS } from '../services/storage';
import { Check, ShieldCheck, Zap, Smartphone, ExternalLink } from 'lucide-react';

export const BookmakersSection: React.FC = () => {
  return (
    <section id="bookmakers" className="py-16 border-b border-slate-800/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-rose-400 uppercase tracking-widest mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Plateformes de Jeu Partenaires
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Les Grands Casinos Proposant le Service Aviator en Afrique de l'Ouest
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed text-balance">
            Notre algorithme prédictif fonctionne avec une précision maximale sur l'ensemble des opérateurs majeurs en Afrique de l'Ouest.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WEST_AFRICA_BOOKMAKERS.map((bookie) => (
            <div
              key={bookie.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-6 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-sm text-white group-hover:scale-105 transition-transform">
                      {bookie.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-rose-400 transition-colors">
                        {bookie.name}
                      </h3>
                      <div className="text-xs text-slate-400">{bookie.aviatorGameName}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {bookie.badge}
                  </span>
                </div>

                <div className="space-y-2 py-3 border-y border-slate-800/80 my-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dépôt minimum :</span>
                    <span className="text-white font-mono font-medium">{bookie.minDeposit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Paiements locaux :</span>
                    <span className="text-emerald-400 font-medium">MTN MoMo, Orange, Moov, Wave</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Note parieurs :</span>
                    <span className="text-amber-400 font-mono font-bold">{bookie.rating}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="text-[11px] text-slate-500 block mb-1">
                    Très populaire en :
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {bookie.popularCountries.map((country, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800"
                      >
                        {country}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/50 flex items-center justify-between text-xs text-rose-400">
                <span className="font-mono text-[11px]">100% Compatible Bot VIP</span>
                <ShieldCheck className="w-4 h-4 text-rose-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
