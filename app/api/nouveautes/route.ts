import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, FieldPacket } from 'mysql2';
import fs from 'fs/promises';
import path from 'path';

interface CountResult extends RowDataPacket {
  total: number;
}

interface TorrentRow extends RowDataPacket {
  id: number;
  title: string;
  year: string;
  poster_url: string;
  genres: string;
  overview: string;
  release_date: string;
  categorie: string;
  created_at: string;
}

type UsersConfig = {
  users: Record<string, { ip_addresses: string[]; last_activity?: string }>;
};

// Helpers to normalize and resolve client IP (aligns with movies/series endpoints)
function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let t = ip.trim();
  if (t.startsWith('::ffff:')) t = t.replace('::ffff:', '');
  if (t === '::1' || t === '0:0:0:0:0:0:0:1') t = '127.0.0.1';
  // strip potential port suffix like 127.0.0.1:54321
  if (/^\d+\.\d+\.\d+\.\d+:.+$/.test(t)) t = t.split(':')[0];
  return t;
}

function getClientIp(req: NextRequest): string | null {
  const directIp = (req as any).ip as string | undefined;
  const xfwd = req.headers.get('x-forwarded-for') || '';
  const xri = req.headers.get('x-real-ip') || '';
  const fromXff = xfwd.split(',')[0]?.trim();
  return normalizeIp(directIp || fromXff || xri || '');
}

async function resolveLastActivityForIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  try {
    const usersPath = path.join(process.cwd(), 'src', 'config', 'users.json');
    const raw = await fs.readFile(usersPath, 'utf-8');
    const data = JSON.parse(raw) as UsersConfig;
    for (const [, user] of Object.entries(data.users || {})) {
      if (Array.isArray(user.ip_addresses) && user.ip_addresses.includes(ip)) {
        return user.last_activity || null;
      }
    }
  } catch (e) {
    console.error('Unable to read users.json for last_activity', e);
  }
  return null;
}

function toMysqlDateTime(d: Date | string): string {
  if (typeof d === 'string') {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) d = parsed;
    else return d; // assume already acceptable
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const countOnly = searchParams.get('count') === 'true';
    const categorie = (searchParams.get('categorie') || '').toLowerCase();

    // Determine per-user cutoff from users.json via IP; fallback to 7 days ago
    const clientIp = getClientIp(req);
    const lastActivity = await resolveLastActivityForIp(clientIp);
    const fallbackDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const cutoff = toMysqlDateTime(lastActivity || fallbackDate);

    // where clause: created_at > cutoff, include all categories (Movies + Series)
    let whereClause = 'WHERE created_at > ?';
    const params: any[] = [cutoff];

    if (categorie === 'movies') {
      whereClause += " AND categorie != 'Série'";
    } else if (categorie === 'series') {
      whereClause += " AND categorie = 'Série'";
    }

    if (countOnly) {
      const [countResult] = await pool.query<CountResult[]>(
        `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new ${whereClause}`,
        params
      );
      return new Response(JSON.stringify({ total: countResult[0]?.total || 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get sorted IDs per distinct title by most recent created_at
    const [sortedIds] = await pool.query<RowDataPacket[]>(
      `SELECT MIN(id) as id
       FROM ygg_torrents_new
       ${whereClause}
       GROUP BY title
       ORDER BY MAX(created_at) DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as [RowDataPacket[], FieldPacket[]];

    if (sortedIds.length === 0) {
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const idList = sortedIds.map((r) => (r as any).id);
    const placeholders = idList.map(() => '?').join(',');

    const [rows] = await pool.query<TorrentRow[]>(
      `SELECT 
        t1.title,
        t1.id,
        (SELECT COUNT(*) FROM ygg_torrents_new t2 WHERE t2.title = t1.title) as count,
        t1.year,
        t1.poster_url,
        t1.genres,
        t1.overview,
        t1.release_date,
        t1.categorie,
        t1.created_at
      FROM ygg_torrents_new t1
      WHERE t1.id IN (${placeholders})
      ORDER BY t1.created_at DESC`,
      [...idList]
    );

    // Also compute total for pagination
    const [countResult] = await pool.query<CountResult[]>(
      `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new ${whereClause}`,
      params
    );

    return new Response(JSON.stringify({ items: rows, total: countResult[0]?.total || 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching nouveautes:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch nouveautes' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
