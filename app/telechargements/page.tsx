"use client";
import React, { useEffect, useState } from "react";
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
}

const STATUTS_TELECHARGES = [
  "✔️ Téléchargé",
  "⌛ Téléchargement"
];

export default function TelechargesPage() {
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categorie, setCategorie] = useState<string>("all");

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white p-8">
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Téléchargements</h1>
        <div className="mb-6 flex items-center gap-4">
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
      </div>
      {loading ? (
        <div className="text-gray-300">Chargement...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : torrents.length === 0 ? (
        <div className="text-gray-400">Aucun torrent téléchargé trouvé.</div>
      ) : (
        <ul className="rounded-xl text-white text-base overflow-x-hidden flex flex-col gap-y-2 space-y-2">
          {torrents.map((torrent, idx) => (
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
              <button
                className="mt-2 md:mt-0 md:ml-4 px-2 py-1 rounded hover:bg-red-600/80 bg-red-700 text-white text-xs opacity-80 group-hover:opacity-100 transition shrink-0"
                title="Supprimer ce torrent"
                onClick={() => alert('WIP')}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
