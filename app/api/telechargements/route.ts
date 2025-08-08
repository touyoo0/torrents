import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
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

type UsersConfig = {
  users: Record<string, { team: string; ip_addresses: string[] }>;
};

function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  // Handle IPv6-mapped IPv4 addresses like ::ffff:192.168.1.24
  if (trimmed.startsWith('::ffff:')) return trimmed.replace('::ffff:', '');
  return trimmed;
}

function getClientIp(req: NextRequest): string | null {
  // Try to read common headers first
  const xff = req.headers.get('x-forwarded-for') || '';
  const xri = req.headers.get('x-real-ip') || '';
  const fromXff = xff.split(',')[0]?.trim();
  const ip = fromXff || xri || (req as any).ip || '';
  return normalizeIp(ip);
}

async function resolveUserFromIp(ip: string | null): Promise<{ username: string; team: string } | null> {
  if (!ip) return null;
  try {
    const usersPath = path.join(process.cwd(), 'src', 'config', 'users.json');
    const raw = await fs.readFile(usersPath, 'utf8');
    const cfg = JSON.parse(raw) as UsersConfig;
    const norm = normalizeIp(ip);
    for (const [username, meta] of Object.entries(cfg.users || {})) {
      const list = Array.isArray(meta.ip_addresses) ? meta.ip_addresses : [];
      // Normalize each stored IP for robust comparison
      const match = list.some(v => normalizeIp(v) === norm);
      if (match) {
        return { username, team: meta.team };
      }
    }
    return null;
  } catch (e) {
    console.error('users.json read/parse error:', e);
    return null;
  }
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

    // Récupérer le répertoire courant
    const [rows] = await pool.query<TorrentRow[]>(
      'SELECT id, repertoire FROM ygg_torrents_new WHERE id = ? LIMIT 1',
      [id]
    );
    const row: any = Array.isArray(rows) && rows.length ? rows[0] : null;
    const repertoire: string | null = row?.repertoire ?? null;

    if (!repertoire || typeof repertoire !== 'string' || repertoire.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Aucun chemin 'repertoire' enregistré pour ce torrent" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Vérifier existence et tenter suppression
    try {
      await fs.stat(repertoire).catch((err: any) => {
        if (err && err.code === 'ENOENT') {
          return null; // déjà inexistant
        }
        throw err;
      });
      await fs.rm(repertoire, { recursive: true, force: true });
    } catch (e: any) {
      console.error('Erreur suppression repertoire:', e?.message || e);
      return new Response(JSON.stringify({ error: `Suppression impossible pour: ${repertoire}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await pool.query(
      "UPDATE ygg_torrents_new SET statut = '➕ Ajouter', repertoire = NULL WHERE id = ?",
      [id]
    );

    return new Response(JSON.stringify({ success: true }), {
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
    // Identify the visitor
    const clientIp = getClientIp(req);
    const user = await resolveUserFromIp(clientIp);

    // If IP not mapped, return empty list (security by default)
    if (!user) {
      return new Response(JSON.stringify({ torrents: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Statuts à inclure
    const statuts = ["✔️ Téléchargé", "⌛ Téléchargement"];
    const { searchParams } = new URL(req.url);
    const categorie = searchParams.get('categorie');

    let whereClause = 'WHERE statut IN (?, ?)';
    const params: any[] = [...statuts];
    if (categorie === 'serie') {
      whereClause += " AND categorie = 'Série'";
    } else if (categorie === 'films') {
      whereClause += " AND categorie != 'Série'";
    }

    // Team-based filtering: Default -> filter by username, Admin -> no additional filter
    if (user.team !== 'Admin') {
      whereClause += ' AND username = ?';
      params.push(user.username);
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
