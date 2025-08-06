"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { FiFilm, FiLoader } from "react-icons/fi";

// Configuration des couleurs pour les cartes
const cardThemes = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-600',
  'from-cyan-400 to-blue-500',
  'from-fuchsia-500 to-purple-500',
];

// Configuration des animations
const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    }
  },
};

interface Movie {
  id: number;
  title: string;
  year: string;
  poster_url: string;
  overview: string;
  genres: string;
  release_date: string;
  categorie: string;
  trailer_url?: string;
}

const MOVIES_PER_PAGE = 20; // Réduit pour améliorer les performances de chargement

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [overviewMovie, setOverviewMovie] = useState<Movie | null>(null);

  const fetchMovies = useCallback(async (page: number) => {
    setLoading(true);
    const offset = (page - 1) * MOVIES_PER_PAGE;
    const res = await fetch(`/api/movies?limit=${MOVIES_PER_PAGE}&offset=${offset}`);
    
    if (res.ok) {
      const data = await res.json();
      const { movies: newMovies, total } = data;
      
      // Vérifier s'il y a des doublons
      const uniqueTitles = new Set<string>();
      const filteredMovies = newMovies.filter((movie: Movie) => {
        if (uniqueTitles.has(movie.title)) {
          return false; // Ignorer les doublons
        }
        uniqueTitles.add(movie.title);
        return true;
      });
      
      setMovies(filteredMovies);
      
      // Utiliser le nombre total de films renvoyé par l'API
      setTotalPages(Math.ceil(total / MOVIES_PER_PAGE));
    }
    setLoading(false);
  }, []);
  
  // Fonction pour récupérer uniquement le nombre total de films
  const fetchTotalMovies = useCallback(async () => {
    const res = await fetch(`/api/movies?count=true`);
    if (res.ok) {
      const data = await res.json();
      setTotalPages(Math.ceil(data.total / MOVIES_PER_PAGE));
    }
  }, []);

  useEffect(() => {
    fetchMovies(currentPage);
    // Remonter en haut de la page lors du changement de page
    window.scrollTo(0, 0);
  }, [currentPage, fetchMovies]);
  
  // Charger le nombre total de films au chargement initial
  useEffect(() => {
    fetchTotalMovies();
  }, [fetchTotalMovies]);
  
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 px-4 py-12 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 font-display">
            Découvrez nos films
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Une sélection des meilleurs films disponibles
          </p>
        </motion.div>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8"
        >
          {movies.map((movie, index) => (
            <motion.div key={movie.id} variants={item} className="h-full">
              <MovieCard movie={movie} index={index} />
            </motion.div>
          ))}
        </motion.div>

        {/* Pagination removed as per user request */}
        
        {/* Loader */}
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex justify-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                transition: {
                  repeat: Infinity,
                  duration: 1.5,
                }
              }}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full backdrop-blur-sm border border-white/5 shadow-lg"
            >
              <FiLoader className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-blue-300 font-medium">Chargement des films...</span>
            </motion.div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

import Link from 'next/link';

function MovieCard({ movie, index }: { movie: Movie; index: number }) {
  const theme = cardThemes[index % cardThemes.length];

  return (
    <Link href={`/movies/title/${encodeURIComponent(movie.title)}`} className="group h-full block">
      <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl transition-all duration-500 hover:shadow-purple-500/20">
        {/* Effet de bordure animée */}
        <div className={`absolute inset-0 rounded-2xl p-[1px]`}>
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${theme} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
        </div>

        <div className="relative z-10 flex h-full flex-col">
          {/* Image avec effet de zoom */}
          <div className="relative overflow-hidden rounded-t-2xl">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"></div>
            
            {movie.poster_url ? (
              <motion.img
                src={movie.poster_url}
                alt={movie.title}
                className="h-[320px] w-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              />
            ) : (
              <div className="flex h-[320px] w-full items-center justify-center bg-slate-800">
                <FiFilm className="h-16 w-16 text-slate-600" />
              </div>
            )}

            {/* Badge d'année */}
            {movie.year && (
              <motion.div 
                className="absolute bottom-4 left-4 z-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 + 0.2 }}
              >
                {movie.year}
              </motion.div>
            )}
          </div>
          
          {/* Contenu texte */}
          <div className="flex flex-1 flex-col p-5">
            <motion.h2 
              className="mb-2 text-center text-lg font-bold text-white line-clamp-2"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.1 }}
            >
              {movie.title}
            </motion.h2>
            
            <div className="mt-auto pt-3">
              <div className="flex flex-wrap justify-center gap-2">
                {movie.genres && movie.genres.split(',').map((g, i) => (
                  <motion.span 
                    key={g}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: index * 0.05 + 0.15 + (i * 0.05),
                      type: "spring",
                      stiffness: 300
                    }}
                    className="inline-block rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
                  >
                    {g.trim()}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
