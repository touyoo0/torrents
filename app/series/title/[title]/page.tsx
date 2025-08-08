'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiArrowLeft, FiPlay, FiChevronRight } from 'react-icons/fi';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

interface Serie {
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

async function getSeriesByTitle(title: string): Promise<Serie[] | null> {
  try {
    const res = await fetch(`/api/series/title/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('Error fetching series:', error);
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
// Examples matched: S01, S1, Saison 1, Season 1, 1x02, S01E02
function extractSeasonNumber(name: string | undefined): number | null {
  if (!name) return null;
  const patterns: RegExp[] = [
    /\bS(?:aison)?[ ._-]?(\d{1,2})\b/i,      // S01 or Saison 01
    /\bSeason[ ._-]?(\d{1,2})\b/i,           // Season 1
    /\bS(\d{1,2})E\d{1,2}\b/i,              // S01E02 -> 01
    /\b(\d{1,2})x\d{1,2}\b/i                // 1x02 -> 1
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

// Extract episode number from common patterns: S01E02, E02, Ep 2, Episode 2, 1x02
function extractEpisodeNumber(name: string | undefined): number | null {
  if (!name) return null;
  const patterns: RegExp[] = [
    /\bS\d{1,2}E(\d{1,3})\b/i,   // S01E02 -> 02
    /\bE(?:pisode)?[ ._-]?(\d{1,3})\b/i, // E02 or Episode 2
    /\bEp[ ._-]?(\d{1,3})\b/i,    // Ep 2
    /\b\d{1,2}x(\d{1,3})\b/i     // 1x02 -> 02
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

export default function SerieTitlePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from');
  const backHref = fromParam === 'nouveautes' ? '/nouveautes' : '/series';
  const backLabel = fromParam === 'nouveautes' ? 'Retour aux nouveautés' : 'Retour aux séries';
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<Record<number, string>>({});
  const [downloadStatus, setDownloadStatus] = useState<Record<number, string>>({});
  const { title: rawTitle } = useParams();
  const title = decodeURIComponent(rawTitle as string);
  const [series, setSeries] = useState<Serie[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusesLoading, setStatusesLoading] = useState<boolean>(true);
  const [expandedSeasons, setExpandedSeasons] = useState<Record<string, boolean>>({});

  // Group torrents by season for rendering
  const groupedBySeason = React.useMemo(() => {
    const groups: Record<string, Serie[]> = {};
    for (const item of series) {
      const seasonNum = extractSeasonNumber(item.name);
      const key = seasonNum ? `Saison ${String(seasonNum).padStart(2, '0')}` : 'Autres';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [series]);

  // Fetch series on mount
  React.useEffect(() => {
    const fetchSeries = async () => {
      const fetched = await getSeriesByTitle(title);
      if (!fetched || fetched.length === 0) {
        window.location.href = '/404';
        return;
      }
      setSeries(fetched);
      setLoading(false);
    };
    fetchSeries();
  }, [title]);

  // Fetch download statuses after series load
  React.useEffect(() => {
    const fetchStatuses = async () => {
      if (!series || series.length === 0) return;
      try {
        setStatusesLoading(true);
        const res = await fetch(`/api/telechargements?categorie=serie`);
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
  }, [series]);

  // Trigger Airflow DAG for a given torrent
  const triggerAirflowDownload = async (torrentId: number, category: string) => {
    try {
      setIsLoading(prev => ({ ...prev, [torrentId]: true }));
      setDownloadStatus(prev => ({ ...prev, [torrentId]: '⌛ Téléchargement' }));
      setStatusMessage(prev => ({ ...prev, [torrentId]: 'Démarrage...' }));

      const torrentIdStr = torrentId.toString();

      const response = await fetch('/api/airflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dagId: 'torrents_download',
          params: {
            torrent_id: torrentIdStr,
            category: category,
            title: title
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
        // Rediriger vers la page téléchargements filtrée sur l'élément en cours
        const item = series.find(s => s.id === torrentId) || series[0];
        const q = item?.title || title;
        setTimeout(() => {
          router.push(`/telechargements?categorie=serie&q=${encodeURIComponent(q)}`);
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
  
  if (!series || series.length === 0) return null;

  // Utiliser la première entrée pour les infos générales
  const mainSerie = series[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white p-8">
      <div className="flex justify-center w-full mb-8">
        <Link href={backHref} className="flex items-center text-slate-300 hover:text-white">
          <FiArrowLeft className="mr-2" /> {backLabel}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Affiche de la série */}
        <div className="lg:col-span-1">
          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-slate-800">
            {mainSerie.poster_url ? (
              <Image
                src={mainSerie.poster_url}
                alt={mainSerie.title}
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

          {mainSerie.trailer_url && (
            <a
              href={mainSerie.trailer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
            >
              <FiPlay className="text-lg" /> Regarder la bande-annonce
            </a>
          )}
        </div>

        {/* Détails de la série */}
        <div className="lg:col-span-2">
          <h1 className="text-4xl font-bold mb-2">
            {mainSerie.title} {mainSerie.year && `(${mainSerie.year})`}
          </h1>
          
          <div className="flex flex-wrap gap-2 my-4">
            {mainSerie.genres?.split(',').map((genre, i) => (
              <span 
                key={i}
                className="inline-block bg-white/10 text-white/80 text-xs px-3 py-1 rounded-full"
              >
                {genre.trim()}
              </span>
            ))}
          </div>
          
          {mainSerie.overview && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-2">Synopsis</h2>
              <p className="text-slate-300">{mainSerie.overview}</p>
            </div>
          )}

          {/* Liste des versions disponibles, groupées par saison */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Saisons disponibles</h2>
            <div className="space-y-8">
              {Object.entries(groupedBySeason)
                .sort((a, b) => {
                  // Put numeric seasons first in ascending order, then 'Autres'
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
                      className={`${expandedSeasons[seasonLabel] ? 'block' : 'hidden'} px-3 pb-3`}
                    >
                      <div className="space-y-6">
                        {(() => {
                          // Group items by quality: 4K, HD, Autres
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
                                      if (aNull) return -1; // nulls first
                                      if (bNull) return 1;
                                      return (ea as number) - (eb as number);
                                    })
                                    .map((serie) => (
                                      <div 
                                        key={serie.id}
                                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 hover:bg-slate-800 transition-colors"
                                      >
                                        {/* Première ligne: qualité, taille et bouton de téléchargement */}
                                        <div className="flex justify-between items-center gap-2 mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded flex-shrink-0">
                                              {extractQuality(serie.name)}
                                            </span>
                                            <span className="text-sm text-slate-400">
                                              {formatSize(serie.size)}
                                            </span>
                                          </div>
                                          {/* Bouton de téléchargement */}
                                          <div className="flex gap-2">
                                            {(() => {
                                              const st = downloadStatus[serie.id];
                                              const isDownloaded = !statusesLoading && st === '✔️ Téléchargé';
                                              const isDownloading = statusesLoading || st === '⌛ Téléchargement' || isLoading[serie.id];
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
                                                  onClick={() => !disabled && triggerAirflowDownload(serie.id, serie.categorie)}
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
                                        {/* Deuxième ligne: titre + saison + épisode (si dispo) */}
                                        <div className="text-sm text-slate-300 overflow-hidden">
                                          <div style={{ wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {(() => {
                                              const rawEp = (serie as any)?.episode;
                                              let epNum: number | null = null;
                                              if (typeof rawEp === 'number') {
                                                epNum = Number.isFinite(rawEp) ? rawEp : null;
                                              } else if (typeof rawEp === 'string') {
                                                const n = parseInt(rawEp, 10);
                                                if (!Number.isNaN(n)) epNum = n;
                                              }
                                              if (epNum == null) epNum = extractEpisodeNumber(serie.name);
                                              const seasonText = seasonLabel && seasonLabel !== 'Autres' ? seasonLabel : '';
                                              return `${serie.title}${seasonText ? ' - ' + seasonText : ''}${epNum != null ? ' - Épisode ' + epNum : ''}${serie.name ? ' (' + serie.name + ')' : ''}`;
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
        </div>
      </div>
    </div>
  );
}
