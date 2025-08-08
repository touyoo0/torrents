"use client";
export const dynamic = 'force-dynamic';
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface Torrent {
  id: number;
  title: string;
  name: string;
  year: string;
  poster_url: string;
  genres: string;
  statut: string;
  categorie: string;
  saison?: number | null;
  episode?: number | null;
  // Optionnel, renvoyé par l'API quand en cours de téléchargement (0..100)
  progress?: number;
}

export default function TelechargesPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white p-8"><div className="container mx-auto py-10 px-4 text-gray-300">Chargement...</div></main>}>
      <TelechargesPageInner />
    </Suspense>
  );
}

const STATUTS_TELECHARGES = [
  "✔️ Téléchargé",
  "⌛ Téléchargement"
];

function TelechargesPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categorie, setCategorie] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [polling, setPolling] = useState<boolean>(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttempts = useRef<number>(0);
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});

  async function handleDelete(id: number) {
    try {
      setDeleting(prev => ({ ...prev, [id]: true }));
      const res = await fetch('/api/telechargements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Suppression échouée');
      }
      // Retirer du listing local immédiatement
      setTorrents(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
      // Optionnel: afficher un toast/alerte
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(prev => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  useEffect(() => {
    async function fetchTorrents() {
      setLoading(true);
      setError(null);
      try {
        let url = "/api/telechargements";
        if (categorie === "serie") url += "?categorie=serie";
        else if (categorie === "films") url += "?categorie=films";
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erreur API");
        const data = await res.json();
        setTorrents(data.torrents || []);
      } catch (e: any) {
        setError(e.message || "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    }
    fetchTorrents();
  }, [categorie]);

  // Initialize from URL params: q and categorie
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const cat = searchParams.get('categorie');
    if (q && q !== query) setQuery(q);
    if (cat && (cat === 'all' || cat === 'films' || cat === 'serie') && cat !== categorie) {
      setCategorie(cat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredTorrents = query.trim().length
    ? torrents.filter(t => {
        const q = query.toLowerCase();
        return (
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.name && t.name.toLowerCase().includes(q))
        );
      })
    : torrents;

  // Polling: refresh automatically while any item is downloading (or when redirected with a query and no results yet)
  useEffect(() => {
    const hasQuery = !!query.trim();
    const noResults = filteredTorrents.length === 0;
    const someDownloading = filteredTorrents.some(t => t.statut === '⌛ Téléchargement');
    // Start polling if: not loading, no error, and (some downloading OR (redirected with a query and no results yet))
    const shouldPoll = !loading && !error && (someDownloading || (hasQuery && noResults));
    if (shouldPoll) {
      setPolling(true);
      // Clear any existing timer
      if (pollTimer.current) {
        clearInterval(pollTimer.current as any);
        pollTimer.current = null;
      }
      // Poll every 2s until results appear and are no longer downloading
      pollTimer.current = setInterval(async () => {
        try {
          // Refetch torrents with current category
          let url = "/api/telechargements";
          if (categorie === "serie") url += "?categorie=serie";
          else if (categorie === "films") url += "?categorie=films";
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) return;
          const data = await res.json();
          setTorrents(data.torrents || []);
        } catch (_) {
          // ignore individual poll errors
        }
      }, 500) as any;
    } else {
      // Stop polling when results appear or conditions change
      if (pollTimer.current) {
        clearInterval(pollTimer.current as any);
        pollTimer.current = null;
      }
      setPolling(false);
    }

    // Cleanup on unmount
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current as any);
        pollTimer.current = null;
      }
    };
  }, [query, categorie, filteredTorrents, loading, error]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white p-8">
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Téléchargements</h1>
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="text-gray-300">Filtrer :</span>
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded font-semibold transition-colors ${categorie === "all" ? "bg-blue-600 text-white" : "bg-slate-700 text-gray-200 hover:bg-blue-900"}`}
                onClick={() => setCategorie("all")}
              >
                Tous
              </button>
              <button
                className={`px-4 py-2 rounded font-semibold transition-colors ${categorie === "films" ? "bg-blue-600 text-white" : "bg-slate-700 text-gray-200 hover:bg-blue-900"}`}
                onClick={() => setCategorie("films")}
              >
                Films
              </button>
              <button
                className={`px-4 py-2 rounded font-semibold transition-colors ${categorie === "serie" ? "bg-blue-600 text-white" : "bg-slate-700 text-gray-200 hover:bg-blue-900"}`}
                onClick={() => setCategorie("serie")}
              >
                Séries
              </button>
            </div>
          </div>
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par titre ou nom..."
              className="w-full rounded-lg bg-slate-800/70 border border-slate-700 text-white placeholder:text-slate-400 px-4 py-2 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>
      {loading ? (
        <div className="text-gray-300">Chargement...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : torrents.length === 0 ? (
        <div className="text-gray-400">Aucun torrent téléchargé trouvé.</div>
      ) : (
        <ul className="rounded-xl text-white text-base overflow-x-hidden flex flex-col gap-y-2 space-y-2">
          {filteredTorrents.map((torrent, idx) => (
            <li key={torrent.id} className={`mb-2 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between group break-words rounded-lg transition-shadow border border-slate-700 ${idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-700/60'} hover:shadow-lg hover:bg-slate-600/60`}
            >
              <div className="min-w-0 flex-1 break-words">
                <span className="font-semibold break-words">{torrent.title}</span>
                {torrent.categorie === "Série" && torrent.saison ? (
                  <span className="ml-2 text-xs text-purple-300 font-mono">
                    S{String(torrent.saison).padStart(2, '0')}
                    {typeof torrent.episode === 'number' && torrent.episode !== null ? `E${String(torrent.episode).padStart(2, '0')}` : ''}
                  </span>
                ) : null}
                <span className="text-gray-400 mx-2">-</span>
                <span className="italic text-blue-300 break-all">{torrent.name}</span>
              </div>
              {(torrent.statut === "⌛ Téléchargement" && (typeof torrent.progress !== 'number' || torrent.progress < 100)) ? (
                <button
                  className="mt-2 md:mt-0 md:ml-4 px-2 py-1 rounded bg-orange-500 text-white text-xs opacity-90 cursor-not-allowed shrink-0"
                  title="Téléchargement en cours"
                  disabled
                >
                  {typeof torrent.progress === 'number'
                    ? `Téléchargement ${Math.max(0, Math.min(100, torrent.progress))}%`
                    : 'Téléchargement...'}
                </button>
              ) : deleting[torrent.id] ? (
                <button
                  className="mt-2 md:mt-0 md:ml-4 px-2 py-1 rounded bg-slate-600 text-white text-xs opacity-80 cursor-not-allowed shrink-0"
                  title="Suppression en cours"
                  disabled
                >
                  Suppression...
                </button>
              ) : (
                <button
                  className="mt-2 md:mt-0 md:ml-4 px-2 py-1 rounded hover:bg-red-600/80 bg-red-700 text-white text-xs opacity-80 group-hover:opacity-100 transition shrink-0"
                  title="Supprimer ce torrent"
                  onClick={() => handleDelete(torrent.id)}
                >
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
