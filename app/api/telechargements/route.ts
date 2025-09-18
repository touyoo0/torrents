import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface TorrentRow extends RowDataPacket {
  id: number;
  title: string;
  name: string;
  year: string;
  poster_url: string;
  genres: string;
  statut: string;
  categorie: string;
  saison: number | null;
  episode: number | null;
  repertoire?: string | null;
}


export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!id || Number.isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Paramètre id invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Déclenche le DAG Airflow torrents_delete via l'endpoint interne
    const airflowUrl = new URL('/api/airflow', req.url).toString();
    const res = await fetch(airflowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dagId: 'torrents_delete', params: { torrent_id: id } }),
    }).catch(() => null);

    if (!res || !res.ok) {
      return new Response(JSON.stringify({ error: "Échec du déclenchement du DAG 'torrents_delete'" }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, triggered: 'torrents_delete' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur API suppression:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    // Always return all downloads (no user filtering)

    // Statuts à inclure
    const statuts = ["✔️ Téléchargé", "⌛ Téléchargement"];
    const { searchParams } = new URL(req.url);
    const categorie = searchParams.get('categorie');

    let whereClause = 'WHERE statut IN (?, ?)';
    const params: any[] = [...statuts];
    if (categorie === 'serie') {
      whereClause += " AND categorie = 'Série'";
    } else if (categorie === 'films') {
      whereClause += " AND categorie IN ('Film','Film d''animation')";
    } else if (categorie === 'animes') {
      whereClause += " AND categorie = 'Série d''animation'";
    }

    const [rows] = await pool.query<TorrentRow[]>(
      `SELECT id, title, name, year, poster_url, genres, statut, categorie, saison, episode
       FROM ygg_torrents_new
       ${whereClause}
       ORDER BY title ASC
       LIMIT 200`,
      params
    );
    // Try to enrich with qBittorrent progress for downloading items
    let enriched = rows as (TorrentRow & { progress?: number })[];
    try {
      const needProgress = Array.isArray(enriched) && enriched.some(r => r.statut === '⌛ Téléchargement');
      const QB_HOST = process.env.QB_HOST;
      const QB_USER = process.env.QB_USER;
      const QB_PASSWORD = process.env.QB_PASSWORD;

      if (needProgress && QB_HOST && QB_USER && QB_PASSWORD) {
        // Login to qBittorrent and capture session cookie
        const loginResp = await fetch(`${QB_HOST}/api/v2/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ username: QB_USER, password: QB_PASSWORD }),
        });
        const setCookie = loginResp.headers.get('set-cookie') || '';
        // Extract SID from Set-Cookie like: SID=xyz; HttpOnly; Path=/
        const sidMatch = /SID=([^;]+)/i.exec(setCookie || '');
        const sid = sidMatch?.[1] ? `SID=${sidMatch[1]}` : '';
        if (loginResp.ok && sid) {
          // Fetch all torrents to include paused items as well
          const headers = { Cookie: sid } as any;
          const allResp = await fetch(`${QB_HOST}/api/v2/torrents/info`, { headers });
          const infos: any[] = allResp.ok ? await allResp.json() : [];

          // Normalize helper
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

          // Prepare qb items with normalized names
          type QbItem = { name: string; n: string; progress?: number };
          const qbItems: QbItem[] = [];
          for (const t of infos) {
            if (t && typeof t.name === 'string') {
              const p = typeof t.progress === 'number' ? Math.round(t.progress * 100) : undefined;
              qbItems.push({ name: t.name, n: norm(t.name), progress: p });
            }
          }

          // Fast exact map on normalized names
          const exact = new Map<string, number>();
          for (const it of qbItems) {
            if (typeof it.progress === 'number') exact.set(it.name, it.progress);
          }

          // Attach to matching rows (exact then partial contains)
          enriched = enriched.map(r => {
            if (r.statut !== '⌛ Téléchargement') return r;
            const rExact = exact.get(r.name);
            if (typeof rExact === 'number') return { ...r, progress: rExact };

            const rn = norm(r.name || '');
            if (!rn) return r;
            let best: number | undefined;
            let bestLen = 0;
            for (const it of qbItems) {
              if (typeof it.progress !== 'number') continue;
              // Two-way contains match on normalized names
              const aInB = it.n.includes(rn);
              const bInA = rn.includes(it.n);
              if (aInB || bInA) {
                const score = Math.min(it.n.length, rn.length);
                if (score > bestLen) {
                  bestLen = score;
                  best = it.progress;
                }
              }
            }
            if (typeof best === 'number') return { ...r, progress: best };
            return r;
          });
        }
      }
    } catch (e) {
      console.error('qBittorrent progress fetch failed:', e);
      // fail silently, keep base rows
    }

    return new Response(JSON.stringify({ torrents: enriched }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur API téléchargés:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
