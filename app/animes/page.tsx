"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, Variants } from "framer-motion";
import { FiFilm, FiLoader } from "react-icons/fi";
import Link from 'next/link';

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

interface Anime {
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

const ANIMES_PER_PAGE = 20;

export default function AnimesPage() {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // États pour la recherche et les filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('latest');
  // Mémorise la dernière requête validée (sans limit/offset)
  const [lastQuery, setLastQuery] = useState<string>('');
  
  // Liste prédéfinie des genres
  const allGenres = [
    'Action', 'Aventure', 'Animation', 'Comédie', 'Crime', 'Documentaire', 'Drame',
    'Familial', 'Fantastique', 'Guerre', 'Historique', 'Horreur', 'Musical',
    'Mystère', 'Romance', 'Science-Fiction', 'Téléfilm', 'Thriller', 'Western'
  ];
  
  // Générer les plages d'années
  const currentYear = new Date().getFullYear();
  const yearRanges: YearRange[] = useMemo(() => {
    const ranges: YearRange[] = [];
    for (let year = 1950; year < 1990; year += 10) {
      ranges.push({
        label: `Années ${year.toString().substring(2)}`,
        value: `decade_${year}`,
        startYear: year,
        endYear: year + 9
      });
    }
    ranges.push({
      label: 'Années 90',
      value: 'decade_1990',
      startYear: 1990,
      endYear: 1999
    });
    for (let year = 2000; year <= currentYear; year++) {
      ranges.push({
        label: year.toString(),
        value: `year_${year}`,
        startYear: year,
        endYear: year
      });
    }
    ranges.sort((a, b) => b.startYear - a.startYear);
    return ranges;
  }, [currentYear]);

  // Récupère les animes pour une page donnée en utilisant la dernière requête validée
  const fetchAnimes = useCallback(async (page: number, queryOverride?: string) => {
    setLoading(true);
    const offset = (page - 1) * ANIMES_PER_PAGE;
    const baseQuery = queryOverride ?? lastQuery;
    const params = new URLSearchParams(baseQuery);
    params.set('limit', ANIMES_PER_PAGE.toString());
    params.set('offset', offset.toString());

    const res = await fetch(`/api/animes?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const { animes: newAnimes, total } = data;
      const uniqueTitles = new Set<string>();
      const filtered = newAnimes.filter((a: Anime) => {
        if (uniqueTitles.has(a.title)) return false;
        uniqueTitles.add(a.title);
        return true;
      });
      setAnimes(filtered);
      setTotalPages(Math.ceil(total / ANIMES_PER_PAGE));
    }
    setLoading(false);
  }, [lastQuery]);

  const fetchTotalAnimes = useCallback(async () => {
    const res = await fetch(`/api/animes?count=true`);
    if (res.ok) {
      const data = await res.json();
      setTotalPages(Math.ceil(data.total / ANIMES_PER_PAGE));
    }
  }, []);

  useEffect(() => {
    fetchAnimes(currentPage);
    window.scrollTo(0, 0);
  }, [currentPage]);

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    // Construire les paramètres de requête (sans limit/offset)
    const params = new URLSearchParams({
      ...(searchQuery && { q: searchQuery }),
      ...(selectedGenre !== 'all' && { genre: selectedGenre }),
      ...(sortBy && { sort: sortBy })
    });
    if (selectedYear !== 'all') {
      const yearRange = yearRanges.find(range => range.value === selectedYear);
      if (yearRange) {
        params.append('startYear', yearRange.startYear.toString());
        params.append('endYear', yearRange.endYear.toString());
      }
    }
    const queryStr = params.toString();
    setLastQuery(queryStr);
    fetchAnimes(1, queryStr);
  }, [searchQuery, selectedGenre, selectedYear, sortBy, yearRanges, fetchAnimes]);

  // Nettoyage: suppression de l'effet redondant de rechargement

  useEffect(() => {
    fetchTotalAnimes();
  }, [fetchTotalAnimes]);

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
            Animés
          </h1>
          {/* Barre sticky: recherche + filtres */}
          <div className="w-full max-w-4xl mx-auto mb-6 sticky top-16 z-30">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md shadow-xl p-4">
              {/* Barre de recherche */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher un anime..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-6 py-3 pr-12 rounded-xl bg-slate-800/80 border border-slate-700/60 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
                <svg 
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {/* Filtres */}
              <div className="flex flex-col items-center justify-center gap-3 mt-3 sm:flex-row sm:flex-wrap">
                {/* Filtre par genre */}
                <div className="relative w-full max-w-[320px] sm:w-auto sm:max-w-none">
                  <select
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="w-full appearance-none bg-slate-800/80 border border-slate-700/60 text-white text-sm md:text-lg rounded-xl px-3 py-2 pr-8 sm:px-4 sm:py-2 md:px-6 md:py-2 md:pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="all">Tous les genres</option>
                    {allGenres.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
                {/* Filtre par année */}
                <div className="relative w-full max-w-[320px] sm:w-auto sm:max-w-none">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full appearance-none bg-slate-800/80 border border-slate-700/60 text-white text-sm md:text-lg rounded-xl px-3 py-2 pr-8 sm:px-4 sm:py-2 md:px-6 md:py-2 md:pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="all">Toutes les années</option>
                    {yearRanges.map((range) => (
                      <option key={range.value} value={range.value}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
                {/* Tri */}
                <div className="relative w-full max-w-[320px] sm:w-auto sm:max-w-none">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full appearance-none bg-slate-800/80 border border-slate-700/60 text-white text-sm md:text-lg rounded-xl px-3 py-2 pr-8 sm:px-4 sm:py-2 md:px-6 md:py-2 md:pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="latest">Plus récents</option>
                    <option value="oldest">Plus anciens</option>
                    <option value="title_asc">Titre (A-Z)</option>
                    <option value="title_desc">Titre (Z-A)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
                {/* Bouton Rechercher */}
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full max-w-[320px] sm:w-auto sm:max-w-none px-4 py-2 md:px-6 md:py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm md:text-base font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Recherche...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Rechercher
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
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
              <span className="text-blue-300 font-medium">Chargement des animes...</span>
            </motion.div>
          </motion.div>
        )}

        {loading ? (
          // Skeletons
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
            {animes.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-400">
                Aucun anime trouvé avec ces critères de recherche.
              </div>
            ) : (
              animes.map((anime, index) => (
                <motion.div key={anime.id} variants={item} className="h-full">
                  <AnimeCard anime={anime} index={index} />
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
              {((currentPage - 1) * ANIMES_PER_PAGE) + 1}-{Math.min(currentPage * ANIMES_PER_PAGE, animes.length + ((currentPage - 1) * ANIMES_PER_PAGE))} sur {totalPages * ANIMES_PER_PAGE}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

function AnimeCard({ anime, index }: { anime: Anime; index: number }) {
  const theme = cardThemes[index % cardThemes.length];

  return (
    <Link href={`/animes/title/${encodeURIComponent(anime.title)}`} className="group h-full block p-1.5">
      <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl transition-all duration-500 hover:shadow-purple-500/20 border-2 border-white/20 group-hover:border-white/40">
        {/* Effet de bordure animée */}
        <div className={`absolute inset-0 rounded-2xl p-[2px]`}>
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${theme} opacity-0 group-hover:opacity-100 transition-all duration-500`}></div>
        </div>

        <div className="relative z-10 flex h-full flex-col">
          {/* Image */}
          <div className="relative aspect-[2/3] overflow-hidden rounded-t-2xl border-b border-white/5 bg-slate-800">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"></div>
            {anime.poster_url ? (
              <motion.img
                src={anime.poster_url}
                alt={anime.title}
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
            {anime.year && (
              <motion.div 
                className="absolute bottom-4 left-4 z-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 + 0.2 }}
              >
                {anime.year}
              </motion.div>
            )}
          </div>
          
          <div className="flex flex-1 flex-col p-5 bg-gradient-to-b from-transparent to-black/20">
            <motion.h2 
              className="mb-2 text-center text-lg font-bold text-white line-clamp-2"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.1 }}
            >
              {anime.title}
            </motion.h2>
            {/* Genres supprimés pour les animes */}
          </div>
        </div>
      </div>
    </Link>
  );
}
