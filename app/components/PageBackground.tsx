"use client";

import React from 'react';

interface PageBackgroundProps {
  children: React.ReactNode;
}

export default function PageBackground({ children }: PageBackgroundProps) {
  return (
    <div className="relative min-h-screen w-full">
      {/* Fond avec dégradé similaire aux pages movies/series */}
      <div className="absolute inset-0 w-full h-full">
        {/* Dégradé de fond */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950" />
        
        {/* Effet de vignette */}
        <div className="absolute inset-0 bg-radial-gradient" />
        
        {/* Effet de grain */}
        <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-noise" />
        
        {/* Points lumineux */}
        <div className="absolute inset-0">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-blue-500/30 blur-xl"
              style={{
                width: `${Math.random() * 10 + 5}px`,
                height: `${Math.random() * 10 + 5}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.2,
                animation: `pulse ${Math.random() * 4 + 3}s infinite alternate`
              }}
            />
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="relative z-10">{children}</div>

      {/* Styles pour les animations et effets */}
      <style jsx global>{`
        .bg-radial-gradient {
          background: radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%);
        }
        
        .bg-noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.2; }
          100% { transform: scale(1.5); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
