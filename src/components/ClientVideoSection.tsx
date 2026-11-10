import React from 'react';
import { Play, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const ClientVideoSection: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-sm space-y-4">
      {/* Header of Video */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-rose-600 font-bold uppercase tracking-wider mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Vidéo Officielle de Présentation · Aviator Spribe</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Comment Fonctionne le Jeu Aviator & l'Algorithme de Décollage
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Démonstration Gameplay (+2 min)</span>
        </div>
      </div>

      {/* Embedded YouTube Video Player (Available & Working SoftGamings/Spribe Aviator Demo) */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 bg-black shadow-md">
        <iframe
          className="w-full h-full"
          src="https://www.youtube.com/embed/QefZm33xT0o?autoplay=0&rel=0&modestbranding=1"
          title="Spribe Aviator Presentation & Gameplay Demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>

      {/* Video caption & instruction for player */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 pt-1">
        <p className="leading-relaxed">
          Visionnez cette vidéo pour comprendre la trajectoire de l'avion et le moment optimal d'encaissement (Cash Out) avant chaque décollage sur <strong>1xBet, Premier Bet, Paripesa, Melbet et Betwinner</strong>.
        </p>
        <span className="text-[11px] font-mono text-slate-400 shrink-0">
          Fournisseur officiel Spribe Gaming
        </span>
      </div>
    </div>
  );
};
