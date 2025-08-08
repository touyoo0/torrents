"use client";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
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

interface Series {
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

const SERIES_PER_PAGE = 20; // Réduit pour améliorer les performances de chargement

export default function SeriesPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [overviewSeries, setOverviewSeries] = useState<Series | null>(null);
  
  // États pour la recherche et les filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('latest');
  
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
    // Ajouter les décennies jusqu'aux années 90
    for (let year = 1950; year < 1990; year += 10) {
      ranges.push({
        label: `Années ${year.toString().substring(2)}`,
        value: `decade_${year}`,
        startYear: year,
        endYear: year + 9
      });
    }
    // Ajouter les années 90
    ranges.push({
      label: 'Années 90',
      value: 'decade_1990',
      startYear: 1990,
      endYear: 1999
    });
    // Ajouter les années individuelles à partir de 2000 jusqu'à l'année en cours
    for (let year = 2000; year <= currentYear; year++) {
      ranges.push({
        label: year.toString(),
        value: `year_${year}`,
        startYear: year,
        endYear: year
      });
    }
    // Trier par année décroissante
    ranges.sort((a, b) => b.startYear - a.startYear);
    return ranges;
  }, [currentYear]);

  const fetchSeries = useCallback(async (page: number) => {
    setLoading(true);
    const offset = (page - 1) * SERIES_PER_PAGE;
    
    // Construire les paramètres de requête
    const params = new URLSearchParams({
      limit: SERIES_PER_PAGE.toString(),
      offset: offset.toString(),
      ...(searchQuery && { q: searchQuery }),
      ...(selectedGenre !== 'all' && { genre: selectedGenre }),
      ...(sortBy && { sort: sortBy })
    });
    
    // Gérer les plages d'années
    if (selectedYear !== 'all') {
      const yearRange = yearRanges.find(range => range.value === selectedYear);
      if (yearRange) {
        params.append('startYear', yearRange.startYear.toString());
        params.append('endYear', yearRange.endYear.toString());
      }
    }
    
    const res = await fetch(`/api/series?${params.toString()}`);
    
    if (res.ok) {
      const data = await res.json();
      const { series: newSeries, total } = data;
      
      // Vérifier s'il y a des doublons
      const uniqueTitles = new Set<string>();
      const filteredSeries = newSeries.filter((serie: Series) => {
        if (uniqueTitles.has(serie.title)) {
          return false; // Ignorer les doublons
        }
        uniqueTitles.add(serie.title);
        return true;
      });
      
      setSeries(filteredSeries);
      
      // Utiliser le nombre total de séries renvoyé par l'API
      setTotalPages(Math.ceil(total / SERIES_PER_PAGE));
    }
    setLoading(false);
  }, [searchQuery, selectedGenre, selectedYear, sortBy, yearRanges]);
  
  // Fonction pour récupérer uniquement le nombre total de séries
  const fetchTotalSeries = useCallback(async () => {
    const res = await fetch(`/api/series?count=true`);
    if (res.ok) {
      const data = await res.json();
      setTotalPages(Math.ceil(data.total / SERIES_PER_PAGE));
    }
  }, []);

  useEffect(() => {
    fetchSeries(currentPage);
    // Remonter en haut de la page lors du changement de page
    window.scrollTo(0, 0);
  }, [currentPage, fetchSeries]);
  
  // Fonction pour déclencher la recherche
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    // Appel direct à fetch avec les paramètres actuels
    const offset = 0; // Première page
    
    // Construire les paramètres de requête
    const params = new URLSearchParams({
      limit: SERIES_PER_PAGE.toString(),
      offset: offset.toString(),
      ...(searchQuery && { q: searchQuery }),
      ...(selectedGenre !== 'all' && { genre: selectedGenre }),
      ...(sortBy && { sort: sortBy })
    });
    
    // Gérer les plages d'années
    if (selectedYear !== 'all') {
      const yearRange = yearRanges.find(range => range.value === selectedYear);
      if (yearRange) {
        params.append('startYear', yearRange.startYear.toString());
        params.append('endYear', yearRange.endYear.toString());
      }
    }
    
    // Effectuer la recherche
    console.log('Requête API envoyée:', `/api/series?${params.toString()}`);
    setLoading(true);
    
    fetch(`/api/series?${params.toString()}`)
      .then(res => {
        console.log('Réponse reçue, statut:', res.status);
        if (!res.ok) {
          throw new Error(`Erreur HTTP: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Données reçues:', data);
        if (data && Array.isArray(data.series)) {
          console.log('Nombre de séries reçues:', data.series.length);
          setSeries(data.series);
          setTotalPages(Math.ceil(data.total / SERIES_PER_PAGE));
        } else {
          console.error('Format de données inattendu:', data);
          setSeries([]);
          setTotalPages(1);
        }
      })
      .catch(error => {
        console.error('Erreur lors de la recherche:', error);
        setSeries([]);
        setTotalPages(1);
      })
      .finally(() => {
        console.log('Fin du chargement');
        setLoading(false);
      });
  }, [searchQuery, selectedGenre, selectedYear, sortBy, yearRanges]);
  
  // Recherche automatique après un délai (désactivé au profit du bouton Rechercher)
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     fetchMovies(1);
  //   }, 300);
  //   
  //   return () => clearTimeout(timer);
  // }, [searchQuery, selectedGenre, selectedYear, sortBy]);
  
  // Recharger les séries lors du changement de page
  useEffect(() => {
    fetchSeries(currentPage);
  }, [currentPage, fetchSeries]);
  
  // Charger le nombre total de séries au chargement initial
  useEffect(() => {
    fetchTotalSeries();
  }, [fetchTotalSeries]);
  
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
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 font-display">
            Séries
          </h1>
          <br />
          
          {/* Barre de recherche */}
          <div className="w-full max-w-2xl mx-auto mb-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher une série..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-6 py-3 pr-12 rounded-full bg-slate-800 border border-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              />
              <svg 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Filtres */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {/* Filtre par genre */}
              <div className="relative">
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="appearance-none bg-slate-800 border border-slate-700 text-white text-sm rounded-full px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">Tous les genres</option>
                  {allGenres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              
              {/* Filtre par année */}
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="appearance-none bg-slate-800 border border-slate-700 text-white text-sm rounded-full px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">Toutes les années</option>
                  {yearRanges.map((range) => (
                    <option key={range.value} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              
              {/* Tri */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-slate-800 border border-slate-700 text-white text-sm rounded-full px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
              <span className="text-blue-300 font-medium">Chargement des séries...</span>
            </motion.div>
          </motion.div>
        )}

        <motion.div 
          variants={container}
          initial="hidden"
          animate={!loading ? "show" : "hidden"}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 mt-4"
        >
          {!loading && series.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400">
              Aucune série trouvée avec ces critères de recherche.
            </div>
          ) : (
            series.map((serie, index) => (
            <motion.div key={serie.id} variants={item} className="h-full">
              <SerieCard serie={serie} index={index} />
            </motion.div>
          )))}
        </motion.div>
        
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
              {((currentPage - 1) * SERIES_PER_PAGE) + 1}-{Math.min(currentPage * SERIES_PER_PAGE, series.length + ((currentPage - 1) * SERIES_PER_PAGE))} sur {totalPages * SERIES_PER_PAGE}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

import Link from 'next/link';

function SerieCard({ serie, index }: { serie: Series; index: number }) {
  const theme = cardThemes[index % cardThemes.length];

  return (
    <Link href={`/series/title/${encodeURIComponent(serie.title)}`} className="group h-full block p-1.5">
      <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl transition-all duration-500 hover:shadow-purple-500/20 border-2 border-white/20 group-hover:border-white/40">
        {/* Effet de bordure animée */}
        <div className={`absolute inset-0 rounded-2xl p-[2px]`}>
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${theme} opacity-0 group-hover:opacity-100 transition-all duration-500`}></div>
        </div>

        <div className="relative z-10 flex h-full flex-col">
          {/* Image avec effet de zoom */}
          <div className="relative aspect-[2/3] overflow-hidden rounded-t-2xl border-b border-white/5 bg-slate-800">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"></div>
            
            {serie.poster_url ? (
              <motion.img
                src={serie.poster_url}
                alt={serie.title}
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
            {serie.year && (
              <motion.div 
                className="absolute bottom-4 left-4 z-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 + 0.2 }}
              >
                {serie.year}
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
              {serie.title}
            </motion.h2>
            
            <div className="mt-auto pt-3">
              <div className="flex flex-wrap justify-center gap-2">
                {serie.genres && serie.genres.split(',').map((g, i) => (
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
