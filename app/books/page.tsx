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
  const [toast, setToast] = useState<{open: boolean; kind: 'success' | 'error'; text: string}>({ open: false, kind: 'success', text: '' });

  // Modal user picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerUsers, setPickerUsers] = useState<Array<{ id: number; name: string; email: string | null }>>([]);
  const [pendingDownload, setPendingDownload] = useState<{ id: number; title: string } | null>(null);

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

  // Open modal and fetch users
  const openUserPicker = async (torrentId: number, title: string) => {
    setPendingDownload({ id: torrentId, title });
    setPickerOpen(true);
    setPickerLoading(true);
    setPickerError(null);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setPickerUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (e) {
      setPickerError("Impossible de récupérer la liste des utilisateurs");
      setPickerUsers([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const triggerDownloadForUser = async (userName: string) => {
    if (!pendingDownload) return;
    const { id: torrentId, title } = pendingDownload;
    setPickerOpen(false);
    setDownloading((m) => ({ ...m, [torrentId]: true }));
    try {
      const res = await fetch('/api/airflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dagId: 'torrents_download',
          params: {
            torrent_id: torrentId,
            category: 'Livres',
            title,
            user: userName,
          },
        }),
      });
      if (!res.ok) throw new Error('Airflow error');
      setToast({ open: true, kind: 'success', text: `Téléchargement lancé pour “${title}”` });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 3000);
    } catch (e) {
      console.error(e);
      setToast({ open: true, kind: 'error', text: "Échec du déclenchement du téléchargement via Airflow" });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 3500);
    } finally {
      setDownloading((m) => ({ ...m, [torrentId]: false }));
      setPendingDownload(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white px-4 py-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`fixed top-4 right-4 z-50 max-w-md w-[92vw] sm:w-auto shadow-lg rounded-xl border backdrop-blur-md px-4 py-3 flex items-start gap-3 ${
              toast.kind === 'success'
                ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-400/10 border-emerald-500/30'
                : 'bg-gradient-to-r from-red-500/10 to-red-400/10 border-red-500/30'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded-full flex items-center justify-center ${toast.kind === 'success' ? 'bg-emerald-600/80' : 'bg-red-600/80'}`}>
              {toast.kind === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-white">
                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414l2.293 2.293 6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-white">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 112 0 1 1 0 01-2 0zm1-8a1 1 0 00-1 1v5a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="text-sm leading-5">
              <div className="font-semibold tracking-wide">
                {toast.kind === 'success' ? 'Téléchargement lancé' : 'Erreur'}
              </div>
              <div className="text-gray-300">{toast.text}</div>
            </div>
            <button
              onClick={() => setToast((t) => ({ ...t, open: false }))}
              className="ml-auto text-gray-300 hover:text-white transition-colors"
              aria-label="Fermer"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
                  className="w-full appearance-none bg-slate-800/80 border border-slate-700/60 text-white text-base rounded-xl px-3 py-2 sm:px-4 sm:py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      onClick={() => openUserPicker(b.id, b.name)}
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

        {/* Modal: Sélecteur d'utilisateur */}
        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              aria-modal="true"
              role="dialog"
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPickerOpen(false)} />
              {/* Modal Content */}
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                className="relative z-10 w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-lg font-semibold">Choisir un utilisateur</h2>
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="text-white/70 hover:text-white"
                    aria-label="Fermer"
                  >
                    ×
                  </button>
                </div>
                <p className="text-sm text-white/70 mb-4">Sélectionnez l'utilisateur pour attribuer ce téléchargement.</p>

                {pickerLoading ? (
                  <div className="text-white/70">Chargement…</div>
                ) : pickerError ? (
                  <div className="text-red-400">{pickerError}</div>
                ) : pickerUsers.length === 0 ? (
                  <div className="text-white/70">Aucun utilisateur disponible.</div>
                ) : (
                  <div className="max-h-72 overflow-auto space-y-2 pr-1">
                    {pickerUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => triggerDownloadForUser(u.name)}
                        className="w-full text-left px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700"
                      >
                        <div className="font-medium">{u.name}</div>
                        {u.email && <div className="text-xs text-white/60">{u.email}</div>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="px-4 py-2 rounded-md border border-slate-700 hover:bg-slate-800"
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
