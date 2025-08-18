'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiArrowLeft, FiPlay, FiChevronRight } from 'react-icons/fi';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

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
  size?: string;
  created_at?: string;
  info_hash?: string;
  name?: string;
}

async function getAnimesByTitle(title: string): Promise<Anime[] | null> {
  try {
    const res = await fetch(`/api/animes/title/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('Error fetching animes:', error);
    return null;
  }
}

function formatSize(sizeInGB: string | undefined): string {
  if (!sizeInGB) return 'Taille inconnue';
  const size = parseFloat(sizeInGB);
  if (isNaN(size)) return 'Taille inconnue';
  return size.toFixed(2) + ' Go';
}

function extractQuality(name: string | undefined): string {
  if (!name) return 'Qualité inconnue';
  if (name.match(/\b(4K|UHD)\b/i)) return '4K';
  if (name.match(/\b(2160P)\b/i)) return '4K';
  if (name.match(/\b(1080P)\b/i)) return 'HD';
  if (name.match(/\b(720P)\b/i)) return 'HD';
  if (name.match(/\b(HDRip|BDRip|BRRip|DVDRip|WebRip)\b/i)) {
    const match = name.match(/\b(HDRip|BDRip|BRRip|DVDRip|WebRip)\b/i);
    return match ? match[0].toUpperCase() : 'Qualité standard';
  }
  return 'Qualité standard';
}

// Try to extract season number from common patterns in torrent names
function extractSeasonNumber(name: string | undefined): number | null {
  if (!name) return null;
  const patterns: RegExp[] = [
    /\bS(?:aison)?[ ._-]?(\d{1,2})\b/i,
    /\bSeason[ ._-]?(\d{1,2})\b/i,
    /\bS(\d{1,2})E\d{1,2}\b/i,
    /\b(\d{1,2})x\d{1,2}\b/i
  ];
  for (const re of patterns) {
    const m = name.match(re);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

// Extract episode number
function extractEpisodeNumber(name: string | undefined): number | null {
  if (!name) return null;
  const patterns: RegExp[] = [
    /\bS\d{1,2}E(\d{1,3})\b/i,
    /\bE(?:pisode)?[ ._-]?(\d{1,3})\b/i,
    /\bEp[ ._-]?(\d{1,3})\b/i,
    /\b\d{1,2}x(\d{1,3})\b/i
  ];
  for (const re of patterns) {
    const m = name.match(re);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Date inconnue';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AnimeTitlePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from');
  const backHref = fromParam === 'nouveautes' ? '/nouveautes' : '/animes';
  const backLabel = fromParam === 'nouveautes' ? 'Retour aux nouveautés' : 'Retour aux animes';
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<Record<number, string>>({});
  const [downloadStatus, setDownloadStatus] = useState<Record<number, string>>({});
  const { title: rawTitle } = useParams();
  const title = decodeURIComponent(rawTitle as string);
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusesLoading, setStatusesLoading] = useState<boolean>(true);
  const [expandedSeasons, setExpandedSeasons] = useState<Record<string, boolean>>({});
  // Recommandations
  const [recs, setRecs] = useState<Anime[]>([]);
  const [recsLoading, setRecsLoading] = useState<boolean>(true);
  const recsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Auto-scroll recommandations
  React.useEffect(() => {
    const el = recsContainerRef.current;
    if (!el) return;
    if (!autoScroll) return;
    if (!recs || recs.length === 0) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let rafId: number;
    const calcSetWidth = () => {
      const cards = Array.from(el.querySelectorAll('[data-rec-card="true"]')) as HTMLElement[];
      const count = Math.min(cards.length / 2, 10);
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
    el.scrollLeft = 0;
    let setWidth = calcSetWidth();
    const step = () => {
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

  React.useEffect(() => {
    const el = recsContainerRef.current;
    if (el) el.scrollLeft = 0;
  }, [recs.length]);

  // Group by season
  const groupedBySeason = React.useMemo(() => {
    const groups: Record<string, Anime[]> = {};
    for (const item of animes) {
      const seasonNum = extractSeasonNumber(item.name);
      const key = seasonNum ? `Saison ${String(seasonNum).padStart(2, '0')}` : 'Autres';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [animes]);

  // Fetch animes on mount
  React.useEffect(() => {
    const fetchAnimes = async () => {
      const fetched = await getAnimesByTitle(title);
      if (!fetched || fetched.length === 0) {
        window.location.href = '/404';
        return;
      }
      setAnimes(fetched);
      setLoading(false);
    };
    fetchAnimes();
  }, [title]);

  // Fetch recommandations
  React.useEffect(() => {
    const fetchRecs = async () => {
      if (!title) return;
      try {
        setRecsLoading(true);
        const res = await fetch(`/api/recommendations?title=${encodeURIComponent(title)}&categorie=${encodeURIComponent("Série d'animation")}&limit=10`);
        if (!res.ok) {
          setRecs([]);
          return;
        }
        const data = await res.json();
        const items = Array.isArray(data?.recommendations) ? data.recommendations : [];
        // On fait confiance à l'API pour la catégorie. Pas de filtre client strict.
        setRecs(items);
        // Active l'auto-scroll uniquement si suffisamment d'éléments
        setAutoScroll(items.length >= 8);
      } catch (e) {
        console.error('Erreur recommandations:', e);
        setRecs([]);
      } finally {
        setRecsLoading(false);
      }
    };
    fetchRecs();
  }, [title]);

  // Fetch download statuses
  React.useEffect(() => {
    const fetchStatuses = async () => {
      if (!animes || animes.length === 0) return;
      try {
        setStatusesLoading(true);
        const res = await fetch(`/api/telechargements?categorie=animes`);
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<number, string> = {};
        if (Array.isArray(data?.torrents)) {
          for (const t of data.torrents) {
            if (typeof t?.id === 'number' && typeof t?.statut === 'string') {
              map[t.id] = t.statut;
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
  }, [animes]);

  // Trigger Airflow DAG
  const triggerAirflowDownload = async (torrentId: number, category: string) => {
    try {
      setIsLoading(prev => ({ ...prev, [torrentId]: true }));
      setDownloadStatus(prev => ({ ...prev, [torrentId]: '⌛ Téléchargement' }));
      setStatusMessage(prev => ({ ...prev, [torrentId]: 'Démarrage...' }));

      const torrentIdStr = torrentId.toString();

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
            category: category,
            title: title,
            ...(currentUser ? { user: currentUser } : {})
          }
        })
      });

      let data: any;
      try {
        data = await response.json();
      } catch (err) {
        console.error('Error parsing response:', err);
        throw new Error('Réponse invalide du serveur');
      }

      if (response.ok) {
        setStatusMessage(prev => ({ ...prev, [torrentId]: 'Téléchargement démarré!' }));
        const item = animes.find(s => s.id === torrentId) || animes[0];
        const q = item?.title || title;
        setTimeout(() => {
          router.push(`/telechargements?categorie=animes&q=${encodeURIComponent(q)}`);
        }, 1000);
      } else {
        setStatusMessage(prev => ({ ...prev, [torrentId]: `Erreur: ${data?.error || 'Échec du téléchargement'}` }));
        setDownloadStatus(prev => { const ns = { ...prev }; delete ns[torrentId]; return ns; });
      }
    } catch (error) {
      console.error('Error triggering Airflow DAG:', error);
      setStatusMessage(prev => ({ ...prev, [torrentId]: 'Erreur de connexion' }));
      setDownloadStatus(prev => { const ns = { ...prev }; delete ns[torrentId]; return ns; });
    } finally {
      setIsLoading(prev => { const ns = { ...prev }; delete ns[torrentId]; return ns; });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white p-8 flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    );
  }
  
  if (!animes || animes.length === 0) return null;

  const mainAnime = animes[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white p-8">
      <div className="flex justify-center w-full mb-8">
        <Link href={backHref} className="flex items-center text-slate-300 hover:text-white">
          <FiArrowLeft className="mr-2" /> {backLabel}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Affiche */}
        <div className="lg:col-span-1">
          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-slate-800">
            {mainAnime.poster_url ? (
              <Image
                src={mainAnime.poster_url}
                alt={mainAnime.title}
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

          {mainAnime.trailer_url && (
            <a
              href={mainAnime.trailer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
            >
              <FiPlay className="text-lg" /> Regarder la bande-annonce
            </a>
          )}
        </div>

        {/* Détails */}
        <div className="lg:col-span-2">
          <h1 className="text-4xl font-bold mb-2">
            {mainAnime.title} {mainAnime.year && `(${mainAnime.year})`}
          </h1>
          
          {/* Genres masqués pour les animes */}
          
          {mainAnime.overview && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-2">Synopsis</h2>
              <p className="text-slate-300">{mainAnime.overview}</p>
            </div>
          )}

          {/* Saisons */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Saisons disponibles</h2>
            <div className="space-y-8">
              {Object.entries(groupedBySeason)
                .sort((a, b) => {
                  const aNum = parseInt(a[0].replace(/\D/g, ''), 10);
                  const bNum = parseInt(b[0].replace(/\D/g, ''), 10);
                  const aIsNum = !Number.isNaN(aNum);
                  const bIsNum = !Number.isNaN(bNum);
                  if (aIsNum && bIsNum) return aNum - bNum;
                  if (aIsNum) return -1;
                  if (bIsNum) return 1;
                  return a[0].localeCompare(b[0]);
                })
                .map(([seasonLabel, items]) => (
                  <div key={seasonLabel} className="border border-slate-800/40 rounded-xl bg-slate-900/20">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800/40 rounded-xl"
                      onClick={() => setExpandedSeasons(prev => ({ ...prev, [seasonLabel]: !prev[seasonLabel] }))}
                      aria-expanded={!!expandedSeasons[seasonLabel]}
                      aria-controls={`season-${seasonLabel}`}
                    >
                      <span className="inline-flex items-center gap-2 text-lg font-semibold text-white/90">
                        <FiChevronRight className={`transition-transform duration-200 ${expandedSeasons[seasonLabel] ? 'rotate-90' : ''}`} />
                        {seasonLabel}
                      </span>
                      <span className="text-xs text-white/60">
                        {items.length} torrent{items.length > 1 ? 's' : ''}
                      </span>
                    </button>

                    <div
                      id={`season-${seasonLabel}`}
                      className={`${expandedSeasons[seasonLabel] ? 'block' : 'hidden'} px-3 pb-3`
                    }>
                      <div className="space-y-6">
                        {(() => {
                          const groups: Record<string, typeof items> = {};
                          for (const it of items) {
                            const q = extractQuality(it.name);
                            const g = q === '4K' ? '4K' : q === 'HD' ? 'HD' : 'Autres';
                            (groups[g] ||= []).push(it);
                          }
                          const order = ['4K', 'HD', 'Autres'];
                          return order
                            .filter(label => groups[label]?.length)
                            .map(label => (
                              <div key={label}>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-sm font-semibold text-white/80">{label}</h4>
                                  <span className="text-[11px] text-white/50">{groups[label].length}</span>
                                </div>
                                <div className="space-y-4">
                                  {[...groups[label]]
                                    .sort((a, b) => {
                                      const ea = extractEpisodeNumber(a.name);
                                      const eb = extractEpisodeNumber(b.name);
                                      const aNull = ea == null;
                                      const bNull = eb == null;
                                      if (aNull && bNull) return (a.title ?? '').localeCompare(b.title ?? '');
                                      if (aNull) return -1;
                                      if (bNull) return 1;
                                      return (ea as number) - (eb as number);
                                    })
                                    .map((anime) => (
                                      <div 
                                        key={anime.id}
                                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 hover:bg-slate-800 transition-colors"
                                      >
                                        {/* Quality/size and download button */}
                                        <div className="flex justify-between items-center gap-2 mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded flex-shrink-0">
                                              {extractQuality(anime.name)}
                                            </span>
                                            <span className="text-sm text-slate-400">
                                              {formatSize(anime.size)}
                                            </span>
                                          </div>
                                          <div className="flex gap-2">
                                            {(() => {
                                              const st = downloadStatus[anime.id];
                                              const isDownloaded = !statusesLoading && st === '✔️ Téléchargé';
                                              const isDownloading = statusesLoading || st === '⌛ Téléchargement' || isLoading[anime.id];
                                              const label = isDownloaded
                                                ? 'Téléchargé'
                                                : isDownloading
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
                                                  onClick={() => !disabled && triggerAirflowDownload(anime.id, anime.categorie)}
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
                                        {/* Title + season + episode */}
                                        <div className="text-sm text-slate-300 overflow-hidden">
                                          <div style={{ wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {(() => {
                                              const rawEp = (anime as any)?.episode;
                                              let epNum: number | null = null;
                                              if (typeof rawEp === 'number') {
                                                epNum = Number.isFinite(rawEp) ? rawEp : null;
                                              } else if (typeof rawEp === 'string') {
                                                const n = parseInt(rawEp, 10);
                                                if (!Number.isNaN(n)) epNum = n;
                                              }
                                              if (epNum == null) epNum = extractEpisodeNumber(anime.name);
                                              const seasonText = seasonLabel && seasonLabel !== 'Autres' ? seasonLabel : '';
                                              return `${anime.title}${seasonText ? ' - ' + seasonText : ''}${epNum != null ? ' - Épisode ' + epNum : ''}${anime.name ? ' (' + anime.name + ')' : ''}`;
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ));
                        })()}
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
                className="flex gap-4 overflow-x-hidden pb-2"
                style={{ scrollBehavior: 'auto' }}
              >
                {recs.slice(0, 10).map((m, idx) => (
                  <Link
                    key={`${m.id}-${m.title}-${idx}`}
                    href={`/animes/title/${encodeURIComponent(m.title)}`}
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
