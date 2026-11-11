import React from 'react';

export const ClientVideoSection: React.FC = () => {
  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-black shadow-md">
      <iframe
        className="w-full h-full"
        src="https://www.youtube.com/embed/a9-BzNM1m_A?rel=0&modestbranding=1&iv_load_policy=3&loop=1&playlist=a9-BzNM1m_A&controls=1"
        title="Démonstration Vidéo Jeu Aviator"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
};
