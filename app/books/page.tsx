"use client";

import React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
 

interface Book {
  id: number;
  name: string;
  size?: string | null;
  created_at?: string | null;
}

// Animations (alignées avec Films/Séries)
const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 14,
    },
  },
};

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);
  const [downloading, setDownloading] = useState<Record<number, boolean>>({});

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (q) params.set('q', q);
      const res = await fetch(`/api/books?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || loading) return;
    setPage(newPage);
    fetchBooks();
    // Remonter en haut de la liste
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBooks();
  };

  const triggerDownload = async (torrentId: number, title: string) => {
    setDownloading((m) => ({ ...m, [torrentId]: true }));
    try {
      // Resolve current user from IP (if available)
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

      const res = await fetch('/api/airflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dagId: 'torrents_download',
          params: {
            torrent_id: torrentId,
            category: 'Livres',
            title,
            ...(currentUser ? { user: currentUser } : {})
          },
        }),
      });
      if (!res.ok) throw new Error('Airflow error');
      alert('OK');
    } catch (e) {
      console.error(e);
      alert("Échec du déclenchement du téléchargement via Airflow");
    } finally {
      setDownloading((m) => ({ ...m, [torrentId]: false }));
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white px-4 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 text-center"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-0 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 font-display">Livres</h1>
        </motion.div>

        <div className="w-full max-w-4xl mx-auto mb-6 sticky top-16 z-30">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md shadow-xl p-4">
            <form onSubmit={onSearch} className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative w-full">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setPage(1), fetchBooks())}
                  placeholder="Rechercher un livre..."
                  className="w-full appearance-none bg-slate-800/80 border border-slate-700/60 text-white text-base md:text-lg rounded-xl px-3 py-2 sm:px-4 sm:py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  inputMode="search"
                />
              </div>
              
              <button
                type="button"
                onClick={() => { setPage(1); fetchBooks(); }}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 md:px-6 md:py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm md:text-base font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a 8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
            </form>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 px-3 py-2 text-xs text-slate-400 border-b border-slate-800">
            <div className="col-span-10">Titre</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {loading ? (
            <div className="p-6 text-center text-slate-400">Chargement...</div>
          ) : books.length === 0 ? (
            <div className="p-6 text-center text-slate-400">Aucun résultat</div>
          ) : (
            <AnimatePresence>
              <motion.ul
                className="divide-y divide-slate-800"
                variants={container}
                initial="hidden"
                animate="show"
              >
              {books.map((b, index) => (
                <motion.li
                  key={b.id}
                  className="grid grid-cols-1 sm:grid-cols-12 items-center px-3 py-3 gap-2"
                  variants={item}
                  layout
                >
                  <div className="sm:col-span-10 sm:pr-3">
                    <div className="text-sm text-white/90" style={{ wordBreak: 'break-word' }}>{b.name}</div>
                    {b.created_at && (
                      <div className="text-xs text-slate-500">Ajouté le {new Date(b.created_at).toLocaleDateString('fr-FR')}</div>
                    )}
                  </div>
                  <div className="sm:col-span-2 text-left sm:text-right">
                    <button
                      onClick={() => triggerDownload(b.id, b.name)}
                      disabled={!!downloading[b.id]}
                      className={`w-full sm:w-auto inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium ${downloading[b.id] ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'}`}
                    >
                      {downloading[b.id] ? 'Téléchargement...' : 'Télécharger'}
                    </button>
                  </div>
                </motion.li>
              ))}
              </motion.ul>
            </AnimatePresence>
          )}
        </div>

        {/* Pagination (style Films/Séries) */}
        {totalPages > 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="text-sm text-gray-400">
              Page {page} sur {totalPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 flex items-center"
              >
                {'<<'}
              </button>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum 
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
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 flex items-center"
              >
                {'>>'}
              </button>
            </div>

            <div className="text-sm text-gray-400">
              {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} sur {total}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
