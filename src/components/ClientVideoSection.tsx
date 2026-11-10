import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';

export const ClientVideoSection: React.FC = () => {
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send command to YouTube iframe via postMessage
  const postToYouTube = (func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: func,
          args: args,
        }),
        '*'
      );
    }
  };

  const handleToggleSound = () => {
    if (isMuted) {
      postToYouTube('unMute');
      postToYouTube('setVolume', [100]);
      setIsMuted(false);
    } else {
      postToYouTube('mute');
      setIsMuted(true);
    }
  };

  const handleTogglePlayback = () => {
    if (isPlaying) {
      postToYouTube('pauseVideo');
      setIsPlaying(false);
    } else {
      postToYouTube('playVideo');
      setIsPlaying(true);
    }
  };

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

      {/* Control Action Bar: Son On/Off & Lecture/Pause as requested by user */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">Contrôles Vidéo :</span>

          {/* Play / Pause Toggle Button */}
          <button
            type="button"
            onClick={handleTogglePlayback}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all shadow-xs cursor-pointer ${
              isPlaying
                ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Mettre sur Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Lancer la Vidéo (ON)</span>
              </>
            )}
          </button>

          {/* Sound On / Sound Off (Mute / Unmute) Toggle Button */}
          <button
            type="button"
            onClick={handleToggleSound}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all shadow-xs cursor-pointer ${
              isMuted
                ? 'bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                <span>Son : Coupé (OFF) · Activer le Son</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />
                <span>Son : Activé (ON) 🔊</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Qualité HD 1080p · Spribe</span>
        </div>
      </div>

      {/* Embedded YouTube Video Player with enablejsapi=1 for precise postMessage control */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 bg-black shadow-md">
        <iframe
          ref={iframeRef}
          className="w-full h-full"
          src="https://www.youtube.com/embed/QefZm33xT0o?enablejsapi=1&rel=0&modestbranding=1&playsinline=1"
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
