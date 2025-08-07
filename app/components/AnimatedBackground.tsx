"use client";

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AnimatedBackgroundProps {
  type: 'movies' | 'series';
}

export default function AnimatedBackground({ type }: AnimatedBackgroundProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);

  useEffect(() => {
    // Générer des particules aléatoires
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 2
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl opacity-20 z-0">
      {/* Fond animé avec des particules */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute rounded-full ${type === 'movies' ? 'bg-blue-300' : 'bg-purple-300'}`}
          initial={{ 
            x: `${particle.x}%`, 
            y: `${particle.y}%`, 
            opacity: 0.3,
            scale: 0.8
          }}
          animate={{ 
            x: [`${particle.x}%`, `${(particle.x + 20) % 100}%`, `${(particle.x - 10) % 100}%`, `${particle.x}%`],
            y: [`${particle.y}%`, `${(particle.y - 15) % 100}%`, `${(particle.y + 10) % 100}%`, `${particle.y}%`],
            opacity: [0.3, 0.7, 0.5, 0.3],
            scale: [0.8, 1.2, 1, 0.8]
          }}
          transition={{
            duration: 8 + particle.delay,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`
          }}
        />
      ))}

      {/* Effet de vague animée */}
      <motion.div 
        className={`absolute inset-0 ${type === 'movies' ? 'bg-blue-600' : 'bg-purple-600'} opacity-10`}
        initial={{ backgroundPosition: '0% 0%' }}
        animate={{ 
          backgroundPosition: ['0% 0%', '100% 100%', '0% 100%', '100% 0%', '0% 0%']
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, transparent 30%, ${type === 'movies' ? '#3b82f6' : '#9333ea'} 70%)`,
          backgroundSize: '200% 200%'
        }}
      />

      {/* Lignes qui se déplacent */}
      <div className="absolute inset-0">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute h-[1px] w-full ${type === 'movies' ? 'bg-blue-400' : 'bg-purple-400'} opacity-30`}
            initial={{ y: 30 * i + 20, scaleX: 0, opacity: 0 }}
            animate={{ 
              scaleX: [0, 1, 0.5, 1, 0],
              opacity: [0, 0.5, 0.3, 0.5, 0],
              y: [30 * i + 20, 30 * i + 25, 30 * i + 35, 30 * i + 40, 30 * i + 45]
            }}
            transition={{
              duration: 8,
              delay: i * 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  );
}
