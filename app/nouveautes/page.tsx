"use client";
import React, { useEffect, useState, useCallback } from "react";
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

interface Nouveautes {
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

interface YearRange {
  label: string;
  value: string;
  startYear: number;
  endYear: number;
}

const NOUVEAUTES_PER_PAGE = 20; // Réduit pour améliorer les performances de chargement

export default function NouveautesPage() {
  const [nouveautes, setNouveautes] = useState<Nouveautes[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [overviewNouveaute, setOverviewNouveaute] = useState<Nouveautes | null>(null);
  const [selectedTab, setSelectedTab] = useState<'films' | 'series'>('films');
  const [marking, setMarking] = useState(false);
  

  const fetchNouveautes = useCallback(async (page: number) => {
    setLoading(true);
    const offset = (page - 1) * NOUVEAUTES_PER_PAGE;
    
    // Construire les paramètres de requête (avec categorie seulement)
    const params = new URLSearchParams({
      limit: NOUVEAUTES_PER_PAGE.toString(),
      offset: offset.toString(),
      categorie: selectedTab === 'films' ? 'movies' : 'series'
    });
    
    const res = await fetch(`/api/nouveautes?${params.toString()}`);
    
    if (res.ok) {
      const data = await res.json();
      // Support both { items } and legacy { nouveautes }
      const rawItems = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.nouveautes) ? data.nouveautes : []);
      const items: Nouveautes[] = rawItems as Nouveautes[];
      const total: number = typeof data?.total === 'number' ? data.total : items.length;
      
      // Vérifier s'il y a des doublons
      const uniqueTitles = new Set<string>();
      const filteredNouveautes = items.filter((nouveaute: Nouveautes) => {
        if (uniqueTitles.has(nouveaute.title)) {
          return false; // Ignorer les doublons
        }
        uniqueTitles.add(nouveaute.title);
        return true;
      });
      
      setNouveautes(filteredNouveautes);
      
      // Utiliser le nombre total renvoyé par l'API, sinon fallback sur la longueur
      setTotalPages(Math.max(1, Math.ceil(total / NOUVEAUTES_PER_PAGE)));
    } else {
      // En cas d'erreur HTTP
      setNouveautes([]);
      setTotalPages(1);
    }
    setLoading(false);
  }, [selectedTab]);
  
  // Fonction pour récupérer uniquement le nombre total de films
  const fetchTotalNouveautes = useCallback(async () => {
    const res = await fetch(`/api/nouveautes?count=true&categorie=${selectedTab === 'films' ? 'movies' : 'series'}`);
    if (res.ok) {
      const data = await res.json();
      const total: number = typeof data?.total === 'number' ? data.total : 0;
      setTotalPages(Math.max(1, Math.ceil(total / NOUVEAUTES_PER_PAGE)));
    }
  }, [selectedTab]);

  const markAsRead = useCallback(async () => {
    try {
      setMarking(true);
      const res = await fetch('/api/nouveautes/mark', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark as read');
      // Reset to first page and refresh counts and list
      setCurrentPage(1);
      await fetchTotalNouveautes();
      await fetchNouveautes(1);
      // Notify navigation to clear the nouveautes badge immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nouveautes:updated', { detail: { count: 0 } }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMarking(false);
    }
  }, [fetchNouveautes, fetchTotalNouveautes]);

  useEffect(() => {
    fetchNouveautes(currentPage);
    // Remonter en haut de la page lors du changement de page
    window.scrollTo(0, 0);
  }, [currentPage, fetchNouveautes]);
  
  // Plus de barre de recherche: on se contente de la pagination

  
  
  // Recharger les films lors du changement de page
  useEffect(() => {
    fetchNouveautes(currentPage);
  }, [currentPage, fetchNouveautes]);
  
  // Charger le nombre total de films au chargement initial
  useEffect(() => {
    fetchTotalNouveautes();
  }, [fetchTotalNouveautes]);
  
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
          className="text-center mb-6 sm:mb-8"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 font-display">
            Nouveautés
          </h1>
          {/* Toggle Films / Séries and Mark button shown only when there are results */}
          {!loading && nouveautes.length > 0 && (
            <>
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => { setSelectedTab('films'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedTab === 'films'
                      ? 'relative overflow-hidden text-white border-0 bg-[linear-gradient(90deg,_#6366f1_0%,_#a855f7_50%,_#ec4899_100%)]'
                      : 'border border-white/20 text-white/80 hover:bg-white/10'
                  }`}
                >
                  Films
                </button>
                <button
                  onClick={() => { setSelectedTab('series'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedTab === 'series'
                      ? 'relative overflow-hidden text-white border-0 bg-[linear-gradient(90deg,_#6366f1_0%,_#a855f7_50%,_#ec4899_100%)]'
                      : 'border border-white/20 text-white/80 hover:bg-white/10'
                  }`}
                >
                  Séries
                </button>
              </div>
              <div className="mt-4 flex items-center justify-center">
                <button
                  onClick={markAsRead}
                  disabled={marking}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors border ${
                    marking
                      ? 'border-white/20 text-white/60 bg-white/5 cursor-not-allowed'
                      : 'border-white/20 text-white/90 hover:bg-white/10'
                  }`}
                >
                  {marking ? 'Nettoyage…' : 'Marquer comme lu'}
                </button>
              </div>
            </>
          )}
        </motion.div>

        {/* Loader */}
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1 mb-1 flex justify-center"
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
              <span className="text-blue-300 font-medium">Chargement des nouveautés...</span>
            </motion.div>
          </motion.div>
        )}

        {loading ? (
          // Skeletons pendant chargement
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 mt-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-full">
                <div className="relative h-full overflow-hidden rounded-2xl bg-slate-800/70 border border-white/10">
                  <div className="aspect-[2/3] w-full bg-slate-700/60 animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 w-3/4 bg-slate-700/60 rounded animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-4 w-16 bg-slate-700/60 rounded-full animate-pulse" />
                      <div className="h-4 w-20 bg-slate-700/60 rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 mt-6"
          >
            {nouveautes.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-400">
                Aucune nouveauté trouvée.
              </div>
            ) : (
              nouveautes.map((nouveaute, index) => (
                <motion.div key={nouveaute.id} variants={item} className="h-full">
                  <NouveauteCard nouveaute={nouveaute} index={index} />
                </motion.div>
              ))
            )}
          </motion.div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="text-sm text-gray-400">
              Page {currentPage} sur {totalPages}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 flex items-center"
              >
                {'<<'}
              </button>
              
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Calculer la plage de pages à afficher
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/20' 
                          : 'border border-gray-700 text-white hover:bg-white/5'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                

              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 flex items-center"
              >
                {'>>'}
              </button>
            </div>
            
            <div className="text-sm text-gray-400">
              {((currentPage - 1) * NOUVEAUTES_PER_PAGE) + 1}-{Math.min(currentPage * NOUVEAUTES_PER_PAGE, nouveautes.length + ((currentPage - 1) * NOUVEAUTES_PER_PAGE))} sur {totalPages * NOUVEAUTES_PER_PAGE}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

import Link from 'next/link';

function NouveauteCard({ nouveaute, index }: { nouveaute: Nouveautes; index: number }) {
  const theme = cardThemes[index % cardThemes.length];
  const targetBase = nouveaute.categorie === 'Série' ? 'series' : 'movies';

  return (
    <Link href={`/${targetBase}/title/${encodeURIComponent(nouveaute.title)}?from=nouveautes`} className="group h-full block p-1.5">
      <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl transition-all duration-500 hover:shadow-purple-500/20 border-2 border-white/20 group-hover:border-white/40">
        {/* Effet de bordure animée */}
        <div className={`absolute inset-0 rounded-2xl p-[2px]`}>
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${theme} opacity-0 group-hover:opacity-100 transition-all duration-500`}></div>
        </div>

        <div className="relative z-10 flex h-full flex-col">
          {/* Image avec effet de zoom */}
          <div className="relative aspect-[2/3] overflow-hidden rounded-t-2xl border-b border-white/5 bg-slate-800">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"></div>
            
            {nouveaute.poster_url ? (
              <motion.img
                src={nouveaute.poster_url}
                alt={nouveaute.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                style={{ objectPosition: 'center top' }}
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
            {nouveaute.year && (
              <motion.div 
                className="absolute bottom-4 left-4 z-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 + 0.2 }}
              >
                {nouveaute.year}
              </motion.div>
            )}
          </div>
          
          {/* Contenu texte */}
          <div className="flex flex-1 flex-col p-5 bg-gradient-to-b from-transparent to-black/20">
            <motion.h2 
              className="mb-2 text-center text-lg font-bold text-white line-clamp-2"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.1 }}
            >
              {nouveaute.title}
            </motion.h2>
            
            <div className="mt-auto pt-3">
              <div className="flex flex-wrap justify-center gap-2">
                {nouveaute.genres && nouveaute.genres.split(',').map((g, i) => (
                  <motion.span 
                    key={g}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: index * 0.05 + 0.15 + (i * 0.05),
                      type: "spring",
                      stiffness: 300
                    }}
                    className="inline-block rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white border border-white/10 hover:border-white/30"
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
