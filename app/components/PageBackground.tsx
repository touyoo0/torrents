"use client";

import React from 'react';

interface PageBackgroundProps {
  children: React.ReactNode;
}

type Dot = {
  width: number;
  height: number;
  top: string;
  left: string;
  opacity: number;
  duration: number;
};

export default function PageBackground({ children }: PageBackgroundProps) {
  const [dots, setDots] = React.useState<Dot[]>([]);

  // Generate dots only on client after mount to avoid SSR hydration mismatch
  React.useEffect(() => {
    const makeDots = (count: number): Dot[] =>
      Array.from({ length: count }).map(() => {
        const w = Math.random() * 10 + 5;
        const h = Math.random() * 10 + 5;
        const t = `${Math.random() * 100}%`;
        const l = `${Math.random() * 100}%`;
        const o = Math.random() * 0.5 + 0.2;
        const d = Math.random() * 4 + 3;
        return { width: w, height: h, top: t, left: l, opacity: o, duration: d };
      });
    setDots(makeDots(20));
  }, []);

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
          {dots.map((dot, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-blue-500/30 blur-xl"
              style={{
                width: `${dot.width}px`,
                height: `${dot.height}px`,
                top: dot.top,
                left: dot.left,
                opacity: dot.opacity,
                animation: `pulse ${dot.duration}s infinite alternate`
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
