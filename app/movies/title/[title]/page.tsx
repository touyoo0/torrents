'use client';

import React, { useState } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FiArrowLeft, FiPlay, FiDownload } from 'react-icons/fi';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

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
    const res = await fetch(`/api/movies/title/${encodeURIComponent(title)}`);
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

export default function MovieTitlePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from');
  const backHref = fromParam === 'nouveautes' ? '/nouveautes' : '/movies';
  const backLabel = fromParam === 'nouveautes' ? 'Retour aux nouveautés' : 'Retour aux films';
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<Record<number, string>>({});
  // Statut de téléchargement par torrent id: '✔️ Téléchargé' | '⌛ Téléchargement'
  const [downloadStatus, setDownloadStatus] = useState<Record<number, string>>({});
  const { title: rawTitle } = useParams();
  const title = decodeURIComponent(rawTitle as string);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  // Indique si les statuts sont en cours de récupération (pour l'affichage des boutons)
  const [statusesLoading, setStatusesLoading] = useState<boolean>(true);
  // Recommandations
  const [recs, setRecs] = useState<Movie[]>([]);
  const [recsLoading, setRecsLoading] = useState<boolean>(true);
  const recsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Auto-scroll des recommandations (pause au survol) avec boucle infinie
  React.useEffect(() => {
    const el = recsContainerRef.current;
    if (!el) return;
    if (!autoScroll) return;
    if (!recs || recs.length === 0) return;
    // Respecte les préférences d'accessibilité
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let rafId: number;
    // Calcule dynamiquement la largeur d'un set (les 10 premières cartes)
    const calcSetWidth = () => {
      const cards = Array.from(el.querySelectorAll('[data-rec-card="true"]')) as HTMLElement[];
      const count = Math.min(cards.length / 2, 10); // on a 2 sets en rendu
      let w = 0;
      for (let i = 0; i < count; i++) {
        const c = cards[i];
        if (!c) break;
        const style = window.getComputedStyle(c);
        const marginRight = parseFloat(style.marginRight || '0');
        w += c.offsetWidth + marginRight;
      }
      return w;
    };
    // reset au changement
    el.scrollLeft = 0;
    let setWidth = calcSetWidth();
    const step = () => {
      // si resize ou images chargées après coup, recalcule périodiquement
      if (setWidth === 0 || el.scrollLeft < 2) {
        setWidth = calcSetWidth();
      }
      el.scrollLeft += 1.0;
      if (setWidth > 0 && el.scrollLeft >= setWidth) {
        el.scrollLeft -= setWidth;
      }
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [autoScroll, recs.length]);

  // Réinitialise la position de scroll quand les recos changent
  React.useEffect(() => {
    const el = recsContainerRef.current;
    if (el) el.scrollLeft = 0;
  }, [recs.length]);
  
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

  // Fetch recommandations après chargement du titre
  React.useEffect(() => {
    const fetchRecs = async () => {
      if (!title) return;
      try {
        setRecsLoading(true);
        const res = await fetch(`/api/recommendations?title=${encodeURIComponent(title)}&categorie=films&limit=10`);
        if (!res.ok) {
          setRecs([]);
          return;
        }
        const data = await res.json();
        setRecs(Array.isArray(data?.recommendations) ? data.recommendations : []);
      } catch (e) {
        console.error('Erreur recommandations:', e);
        setRecs([]);
      } finally {
        setRecsLoading(false);
      }
    };
    fetchRecs();
  }, [title]);
  
  // Après le chargement des films, récupérer les statuts de téléchargement
  React.useEffect(() => {
    const fetchStatuses = async () => {
      if (!movies || movies.length === 0) return;
      try {
        setStatusesLoading(true);
        const main = movies[0];
        // Mapper la catégorie vers le paramètre attendu par l'API
        const catParam = main.categorie === 'Série' ? 'serie' : 'films';
        const res = await fetch(`/api/telechargements?categorie=${encodeURIComponent(catParam)}`);
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<number, string> = {};
        if (Array.isArray(data?.torrents)) {
          for (const t of data.torrents) {
            if (typeof t?.id === 'number' && typeof t?.statut === 'string') {
              map[t.id] = t.statut; // '✔️ Téléchargé' ou '⌛ Téléchargement'
            }
          }
        }
        setDownloadStatus(map);
      } catch (e) {
        console.error('Erreur récupération statuts:', e);
      } finally {
        setStatusesLoading(false);
      }
    };
    fetchStatuses();
  }, [movies]);
  
  // Function to trigger Airflow DAG for downloading
  const triggerAirflowDownload = async (torrentId: number, category: string) => {
    try {
      // Set loading state for this specific torrent
      setIsLoading(prev => ({ ...prev, [torrentId]: true }));
      // Mettre immédiatement le statut à "Téléchargement"
      setDownloadStatus(prev => ({ ...prev, [torrentId]: '⌛ Téléchargement' }));
      setStatusMessage(prev => ({ ...prev, [torrentId]: 'Démarrage...' }));
      
      // Convert torrentId to string to ensure proper JSON serialization
      const torrentIdStr = torrentId.toString();

      // Resolve current user from IP
      let currentUser: string | null = null;
      try {
        const who = await fetch('/api/whoami');
        if (who.ok) {
          const data = await who.json();
          if (data && data.user && typeof data.user.username === 'string') {
            currentUser = data.user.username;
          }
        }
      } catch {}
      
      const response = await fetch('/api/airflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dagId: 'torrents_download',
          params: {
            torrent_id: torrentIdStr,
            ...(currentUser ? { user: currentUser } : {})
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
        // Rediriger vers la page téléchargements filtrée sur l'élément en cours
        const catParam = category === 'Série' ? 'serie' : 'films';
        const item = movies.find(m => m.id === torrentId) || movies[0];
        const q = item?.title || title;
        setTimeout(() => {
          router.push(`/telechargements?categorie=${encodeURIComponent(catParam)}&q=${encodeURIComponent(q)}`);
        }, 1000);
      } else {
        setStatusMessage(prev => ({ ...prev, [torrentId]: `Erreur: ${data.error || 'Échec du téléchargement'}` }));
        // En cas d'erreur, permettre un nouveau clic
        setDownloadStatus(prev => {
          const ns = { ...prev };
          delete ns[torrentId];
          return ns;
        });
      }
    } catch (error) {
      console.error('Error triggering Airflow DAG:', error);
      setStatusMessage(prev => ({ ...prev, [torrentId]: 'Erreur de connexion' }));
      // En cas d'erreur réseau, permettre un nouveau clic
      setDownloadStatus(prev => {
        const ns = { ...prev };
        delete ns[torrentId];
        return ns;
      });
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
        <Link href={backHref} className="flex items-center text-slate-300 hover:text-white">
          <FiArrowLeft className="mr-2" /> {backLabel}
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
              {[...movies].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")).map((movie) => (
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

                      {/* Bouton pour déclencher le DAG Airflow */}
                      {(() => {
                        const st = downloadStatus[movie.id];
                        const isDownloaded = !statusesLoading && st === '✔️ Téléchargé';
                        const isDownloading = statusesLoading || st === '⌛ Téléchargement' || isLoading[movie.id];
                        const label = isDownloaded
                          ? 'Téléchargé'
                          : st === '⌛ Téléchargement' || isLoading[movie.id]
                          ? 'Téléchargement...'
                          : 'Télécharger';
                        const className = statusesLoading
                          ? 'bg-gray-500 cursor-not-allowed'
                          : isDownloaded
                          ? 'bg-green-600 cursor-not-allowed'
                          : isDownloading
                          ? 'bg-orange-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700';
                        const disabled = statusesLoading || isDownloaded || isDownloading;
                        const showSpinner = statusesLoading;
                        return (
                          <button
                            onClick={() => !disabled && triggerAirflowDownload(movie.id, movie.categorie)}
                            disabled={disabled}
                            className={`${className} text-white rounded-lg inline-flex items-center justify-center px-3 py-1 text-xs font-medium flex-shrink-0`}
                            title={isDownloaded ? 'Déjà téléchargé' : 'Télécharger via Airflow'}
                          >
                            {showSpinner ? (
                              <span
                                className="inline-block h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"
                                aria-label="Chargement"
                                role="status"
                              />
                            ) : (
                              label
                            )}
                          </button>
                        );
                      })()}
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

          {/* Du même genre.. */}
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Du même genre..</h2>
            {recsLoading ? (
              <div className="text-slate-400 text-sm">Chargement des recommandations...</div>
            ) : recs.length === 0 ? (
              <div className="text-slate-500 text-sm">Aucune recommandation trouvée.</div>
            ) : (
              <div
                ref={recsContainerRef}
                className="flex overflow-x-hidden pb-2"
                style={{ scrollBehavior: 'auto' }}
              >
                {[...recs.slice(0, 10), ...recs.slice(0, 10)].map((m, idx) => (
                  <Link
                    key={`${m.id}-${m.title}-${idx}`}
                    href={`/movies/title/${encodeURIComponent(m.title)}`}
                    className="group block flex-shrink-0 w-36 sm:w-40 mr-4"
                    data-rec-card="true"
                  >
                    <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-800">
                      {m.poster_url ? (
                        <Image src={m.poster_url} alt={m.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl text-slate-500">🎬</div>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-white/90 line-clamp-2 text-center">{m.title}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
