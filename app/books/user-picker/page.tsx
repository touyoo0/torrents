"use client";

import React, { useEffect, useState } from 'react';

interface User {
  id: number;
  name: string;
  email: string | null;
}

export default function UserPickerPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!aborted) setUsers(Array.isArray(data?.users) ? data.users : []);
      } catch (e) {
        if (!aborted) setError('Impossible de récupérer la liste des utilisateurs');
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, []);

  const selectUser = (u: User) => {
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'books:user-selected', user: { name: u.name } }, '*');
      }
    } catch {}
    window.close();
  };

  const cancel = () => {
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'books:user-cancelled' }, '*');
      }
    } catch {}
    window.close();
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white px-4 py-6">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Choisir un utilisateur</h1>
        <p className="text-sm text-white/70 mb-6">Sélectionnez l'utilisateur pour attribuer ce téléchargement.</p>
        {loading ? (
          <div className="text-white/70">Chargement…</div>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : users.length === 0 ? (
          <div className="text-white/70">Aucun utilisateur disponible.</div>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => selectUser(u)}
                  className="w-full text-left px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700"
                >
                  <div className="font-medium">{u.name}</div>
                  {u.email && <div className="text-xs text-white/60">{u.email}</div>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <button onClick={cancel} className="px-4 py-2 rounded-md border border-slate-700 hover:bg-slate-800">Annuler</button>
        </div>
      </div>
    </main>
  );
}
