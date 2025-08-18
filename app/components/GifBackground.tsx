"use client";

import React from 'react';
import Image from 'next/image';

interface GifBackgroundProps {
  type: 'movies' | 'series' | 'books' | 'animes';
}

export default function GifBackground({ type }: GifBackgroundProps) {
  // URLs des GIFs pour les films et séries
  const gifUrls: Record<GifBackgroundProps['type'], string> = {
    // Animation film fournie par l'utilisateur
    movies: "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExanQ5NDEwdTl6YWE2Y21vbmVtc2xxb25memFoNHRycG8xYm5tY2JxMSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/vBjLa5DQwwxbi/giphy.gif", 
    // Animation TV fournie par l'utilisateur
    series: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTdydXN3MDR4MWs4ZTRqNWQ3NWcxYTAyaWd1YmJsbXM4Y3pta2dlcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oEjI1erPMTMBFmNHi/giphy.gif",
    // Books (cat with book)
    books: "https://media.giphy.com/media/1TgECF0mNVirC/giphy.gif",
    // Animes (fourni par l'utilisateur)
    animes: "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZGdjaGg0Z2t3eW5iMGliYXg2M25tY3d6d2V6cWpld2NvNTNkaWp5NyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/cpkQpkVFOOoNi/giphy.gif"
  };

  const gradientClass: Record<GifBackgroundProps['type'], string> = {
    movies: 'bg-gradient-to-br from-blue-900 to-blue-700',
    series: 'bg-gradient-to-br from-purple-900 to-purple-700',
    books: 'bg-gradient-to-br from-emerald-900 to-emerald-700',
    animes: 'bg-gradient-to-br from-rose-900 to-rose-700',
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden rounded-xl z-0">
      <div 
        className="absolute inset-0 w-full h-full opacity-40"
        style={{
          backgroundImage: `url(${gifUrls[type]})`,
          backgroundSize: type === 'movies' ? '150%' : 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          mixBlendMode: 'soft-light',
          filter: 'contrast(1.2) brightness(0.8)'
        }}
      />
      {/* Overlay pour améliorer la lisibilité du texte */}
      <div 
        className={`absolute inset-0 ${gradientClass[type]} opacity-70`}
      />
      {/* Effet de scintillement */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)',
          backgroundSize: '120% 120%',
          backgroundPosition: 'center',
          animation: 'pulse 4s infinite'
        }}
      />
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.05; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(1.05); }
          100% { opacity: 0.05; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
