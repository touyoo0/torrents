'use client';

import React, { useState } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FiArrowLeft, FiPlay, FiDownload } from 'react-icons/fi';

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
  size?: string;
  created_at?: string;
  info_hash?: string;
  name?: string;
}

async function getMoviesByTitle(title: string): Promise<Movie[] | null> {
  try {
    const res = await fetch(`http://localhost:3000/api/movies/title/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('Error fetching movies:', error);
    return null;
  }
}

function formatSize(sizeInGB: string | undefined): string {
  if (!sizeInGB) return 'Taille inconnue';
  const size = parseFloat(sizeInGB);
  if (isNaN(size)) return 'Taille inconnue';
  
  // La taille est déjà en Go, juste formater avec 2 décimales
  return size.toFixed(2) + ' Go';
}

function extractQuality(name: string | undefined): string {
  if (!name) return 'Qualité inconnue';
  
  // Rechercher les qualités courantes dans le nom du torrent
  if (name.match(/\b(4K|UHD)\b/i)) {
    return '4K';
  } else if (name.match(/\b(2160P)\b/i)) {
    return '4K';
  } else if (name.match(/\b(1080P)\b/i)) {
    return 'HD';
  } else if (name.match(/\b(720P)\b/i)) {
    return 'HD';
  } else if (name.match(/\b(HDRip|BDRip|BRRip|DVDRip|WebRip)\b/i)) {
    const match = name.match(/\b(HDRip|BDRip|BRRip|DVDRip|WebRip)\b/i);
    return match ? match[0].toUpperCase() : 'Qualité standard';
  }
  
  return 'Qualité standard';
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Date inconnue';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export default function MovieTitlePage({ params }: { params: { title: string } }) {
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<Record<number, string>>({});
  const title = decodeURIComponent(params.title);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch movies on component mount
  React.useEffect(() => {
    const fetchMovies = async () => {
      const fetchedMovies = await getMoviesByTitle(title);
      if (!fetchedMovies || fetchedMovies.length === 0) {
        // Handle not found case in client component
        window.location.href = '/404';
        return;
      }
      setMovies(fetchedMovies);
      setLoading(false);
    };
    
    fetchMovies();
  }, [title]);
  
  // Function to trigger Airflow DAG for downloading
  const triggerAirflowDownload = async (torrentId: number, category: string) => {
    try {
      // Set loading state for this specific torrent
      setIsLoading(prev => ({ ...prev, [torrentId]: true }));
      setStatusMessage(prev => ({ ...prev, [torrentId]: 'Démarrage...' }));
      
      // Convert torrentId to string to ensure proper JSON serialization
      const torrentIdStr = torrentId.toString();
      
      const response = await fetch('/api/airflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dagId: 'torrents_download',
          params: {
            torrent_id: torrentIdStr,
            category: category
          }
        })
      });
      
      let data;
      try {
        data = await response.json();
      } catch (error) {
        console.error('Error parsing response:', error);
        throw new Error('Réponse invalide du serveur');
      }
      
      if (response.ok) {
        setStatusMessage(prev => ({ ...prev, [torrentId]: 'Téléchargement démarré!' }));
        // Reset status message after 3 seconds
        setTimeout(() => {
          setStatusMessage(prev => {
            const newState = { ...prev };
            delete newState[torrentId];
            return newState;
          });
        }, 3000);
      } else {
        setStatusMessage(prev => ({ ...prev, [torrentId]: `Erreur: ${data.error || 'Échec du téléchargement'}` }));
      }
    } catch (error) {
      console.error('Error triggering Airflow DAG:', error);
      setStatusMessage(prev => ({ ...prev, [torrentId]: 'Erreur de connexion' }));
    } finally {
      setIsLoading(prev => {
        const newState = { ...prev };
        delete newState[torrentId];
        return newState;
      });
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white p-8 flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    );
  }
  
  if (!movies || movies.length === 0) return null;

  // Utiliser le premier film pour les informations générales
  const mainMovie = movies[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white p-8">
      <div className="flex justify-center w-full mb-8">
        <Link href="/movies" className="flex items-center text-slate-300 hover:text-white">
          <FiArrowLeft className="mr-2" /> Retour aux films
        </Link>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Affiche du film */}
        <div className="lg:col-span-1">
          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-slate-800">
            {mainMovie.poster_url ? (
              <Image
                src={mainMovie.poster_url}
                alt={mainMovie.title}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-4xl text-slate-500">🎬</div>
              </div>
            )}
          </div>
          
          {mainMovie.trailer_url && (
            <a
              href={mainMovie.trailer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
            >
              <FiPlay className="text-lg" /> Regarder la bande-annonce
            </a>
          )}
        </div>
        
        {/* Détails du film */}
        <div className="lg:col-span-2">
          <h1 className="text-4xl font-bold mb-2">
            {mainMovie.title} {mainMovie.year && `(${mainMovie.year})`}
          </h1>
          
          <div className="flex flex-wrap gap-2 my-4">
            {mainMovie.genres?.split(',').map((genre, i) => (
              <span 
                key={i}
                className="inline-block bg-white/10 text-white/80 text-xs px-3 py-1 rounded-full"
              >
                {genre.trim()}
              </span>
            ))}
          </div>
          
          {mainMovie.overview && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-2">Synopsis</h2>
              <p className="text-slate-300">{mainMovie.overview}</p>
            </div>
          )}
          
          {/* Liste des versions disponibles */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Versions disponibles</h2>
            <div className="space-y-4"> 
              {movies.map((movie) => (
                <div 
                  key={movie.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 hover:bg-slate-800 transition-colors"
                >
                  {/* Première ligne: qualité, taille et bouton de téléchargement */}
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded flex-shrink-0">
                        {extractQuality(movie.name)}
                      </span>
                      <span className="text-sm text-slate-400">
                        {formatSize(movie.size)}
                      </span>
                    </div>
                    
                    {/* Bouton de téléchargement */}
                    <div className="flex gap-2">
                      {/* Bouton magnet original */}
                      <a 
                        href={`magnet:?xt=urn:btih:${movie.info_hash}`}
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg inline-flex items-center justify-center w-7 h-7 p-1.5 flex-shrink-0"
                        title="Télécharger via magnet"
                      >
                        <FiDownload className="w-4 h-4" />
                      </a>
                      
                      {/* Bouton pour déclencher le DAG Airflow */}
                      <button
                        onClick={() => triggerAirflowDownload(movie.id, movie.categorie)}
                        disabled={isLoading[movie.id]}
                        className={`${isLoading[movie.id] ? 'bg-gray-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'} text-white rounded-lg inline-flex items-center justify-center px-3 py-1 text-xs font-medium flex-shrink-0`}
                        title="Télécharger via Airflow"
                      >
                        {isLoading[movie.id] ? 'En cours...' : statusMessage[movie.id] || 'Airflow'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Deuxième ligne: nom du torrent */}
                  <div className="text-sm text-slate-300 overflow-hidden">
                    <div style={{ wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {movie.name}
                    </div>
                  </div>
                </div>
              ))}
            
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
