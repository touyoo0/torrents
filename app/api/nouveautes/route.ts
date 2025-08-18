import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, FieldPacket } from 'mysql2';
// removed fs/path: last_activity now resolved from DB

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

// users.json config removed in favor of users table lookup

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
    // Try to match against different possible formats stored in users.ip_adresses (varchar255):
    // - JSON array string of IPs (e.g., ["1.2.3.4","5.6.7.8"]) -> JSON_VALID + JSON_CONTAINS
    // - Comma-separated list (e.g., 1.2.3.4,5.6.7.8) -> FIND_IN_SET after stripping brackets/quotes
    // - Single IP string -> equality
    const query = `
      SELECT last_activity
      FROM users
      WHERE (
        (JSON_VALID(ip_adresses) AND JSON_CONTAINS(CAST(ip_adresses AS JSON), JSON_QUOTE(?)))
        OR ip_adresses = ?
        OR FIND_IN_SET(?, REPLACE(REPLACE(REPLACE(ip_adresses,'"',''), '[',''),']',''))
      )
      ORDER BY last_activity DESC
      LIMIT 1
    `;
    const [rows] = await pool.query<RowDataPacket[]>(query, [ip, ip, ip]);
    if ((rows as any).length > 0) {
      const la: any = (rows as any)[0].last_activity;
      // Normalize to string for downstream toMysqlDateTime
      if (la instanceof Date) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${la.getFullYear()}-${pad(la.getMonth() + 1)}-${pad(la.getDate())} ${pad(la.getHours())}:${pad(la.getMinutes())}:${pad(la.getSeconds())}`;
      }
      if (typeof la === 'string') return la;
    }
  } catch (e) {
    console.error('Unable to resolve last_activity from users table', e);
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

    // where clause: created_at > cutoff AND release_date within last 365 days, include all categories (Movies + Series)
    // Note: guard against empty-string release_date values
    let whereClause = "WHERE created_at > ? AND release_date IS NOT NULL AND release_date <> '' AND DATEDIFF(CURDATE(), DATE(release_date)) < 365";
    const params: any[] = [cutoff];

    if (categorie === 'movies') {
      whereClause += " AND categorie IN ('Film','Film d''animation')";
    } else if (categorie === 'series') {
      whereClause += " AND categorie = 'Série'";
    } else if (categorie === 'animes') {
      whereClause += " AND categorie = 'Série d''animation'";
    }

    if (countOnly) {
      // For series: only include titles that did NOT exist before lastActivity (cutoff)
      const [countResult] = await pool.query<CountResult[]>(
        categorie === 'series'
          ? `SELECT COUNT(*) as total FROM (
               SELECT t.title
               FROM ygg_torrents_new t
               WHERE t.created_at > ?
                 AND t.release_date IS NOT NULL AND t.release_date <> ''
                 AND DATEDIFF(CURDATE(), DATE(t.release_date)) < 365
                 AND t.categorie = 'Série'
                 AND NOT EXISTS (
                   SELECT 1 FROM ygg_torrents_new tp
                   WHERE tp.title = t.title AND tp.created_at <= ?
                 )
               GROUP BY t.title
             ) as x`
          : categorie === 'animes'
          ? `SELECT COUNT(*) as total FROM (
               SELECT t.title
               FROM ygg_torrents_new t
               WHERE t.created_at > ?
                 AND t.release_date IS NOT NULL AND t.release_date <> ''
                 AND DATEDIFF(CURDATE(), DATE(t.release_date)) < 365
                 AND t.categorie = 'Série d''animation'
                 AND NOT EXISTS (
                   SELECT 1 FROM ygg_torrents_new tp
                   WHERE tp.title = t.title AND tp.created_at <= ?
                 )
               GROUP BY t.title
             ) as x`
          : `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new ${whereClause}`,
        categorie === 'series' ? [cutoff, cutoff] : (categorie === 'animes' ? [cutoff, cutoff] : params)
      );
      return new Response(JSON.stringify({ total: countResult[0]?.total || 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get sorted IDs per distinct title by most recent created_at
    const [sortedIds] = await pool.query<RowDataPacket[]>(
      categorie === 'series'
        ? `SELECT MIN(t.id) as id
           FROM ygg_torrents_new t
           WHERE t.created_at > ?
             AND t.release_date IS NOT NULL AND t.release_date <> ''
             AND DATEDIFF(CURDATE(), DATE(t.release_date)) < 365
             AND t.categorie = 'Série'
             AND NOT EXISTS (
               SELECT 1 FROM ygg_torrents_new tp
               WHERE tp.title = t.title AND tp.created_at <= ?
             )
           GROUP BY t.title
           ORDER BY MAX(t.created_at) DESC
           LIMIT ? OFFSET ?`
        : categorie === 'animes'
        ? `SELECT MIN(t.id) as id
           FROM ygg_torrents_new t
           WHERE t.created_at > ?
             AND t.release_date IS NOT NULL AND t.release_date <> ''
             AND DATEDIFF(CURDATE(), DATE(t.release_date)) < 365
             AND t.categorie = 'Série d''animation'
             AND NOT EXISTS (
               SELECT 1 FROM ygg_torrents_new tp
               WHERE tp.title = t.title AND tp.created_at <= ?
             )
           GROUP BY t.title
           ORDER BY MAX(t.created_at) DESC
           LIMIT ? OFFSET ?`
        : `SELECT MIN(id) as id
           FROM ygg_torrents_new
           ${whereClause}
           GROUP BY title
           ORDER BY MAX(created_at) DESC
           LIMIT ? OFFSET ?`,
      categorie === 'series'
        ? [cutoff, cutoff, limit, offset]
        : (categorie === 'animes' ? [cutoff, cutoff, limit, offset] : [...params, limit, offset])
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
      categorie === 'series'
        ? `SELECT COUNT(*) as total FROM (
             SELECT t.title
             FROM ygg_torrents_new t
             WHERE t.created_at > ?
               AND t.release_date IS NOT NULL AND t.release_date <> ''
               AND DATEDIFF(CURDATE(), DATE(t.release_date)) < 365
               AND t.categorie = 'Série'
               AND NOT EXISTS (
                 SELECT 1 FROM ygg_torrents_new tp
                 WHERE tp.title = t.title AND tp.created_at <= ?
               )
             GROUP BY t.title
           ) as x`
        : categorie === 'animes'
        ? `SELECT COUNT(*) as total FROM (
             SELECT t.title
             FROM ygg_torrents_new t
             WHERE t.created_at > ?
               AND t.release_date IS NOT NULL AND t.release_date <> ''
               AND DATEDIFF(CURDATE(), DATE(t.release_date)) < 365
               AND t.categorie = 'Série d''animation'
               AND NOT EXISTS (
                 SELECT 1 FROM ygg_torrents_new tp
                 WHERE tp.title = t.title AND tp.created_at <= ?
               )
             GROUP BY t.title
           ) as x`
        : `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new ${whereClause}`,
      categorie === 'series' ? [cutoff, cutoff] : (categorie === 'animes' ? [cutoff, cutoff] : params)
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
