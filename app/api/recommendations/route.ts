import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface TitleInfo extends RowDataPacket {
  genres: string | null;
  categorie: string | null;
}

interface RecRow extends RowDataPacket {
  id: number;
  title: string;
  year: string;
  poster_url: string | null;
  genres: string | null;
  overview: string | null;
  release_date: string | null;
  categorie: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title') || '';
    const catParam = searchParams.get('categorie'); // 'films' | 'serie' | exact category string (e.g., "Série d'animation") | undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 20);

    if (!title) {
      return new Response(JSON.stringify({ error: 'Paramètre "title" requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch base info for the given title
    const [baseRows] = await pool.query<TitleInfo[]>(
      'SELECT genres, categorie FROM ygg_torrents_new WHERE title = ? LIMIT 1',
      [title]
    );

    // Decide category filtering strategy
    // categoryEq: exact category equality (e.g., 'Série' or "Série d'animation")
    // excludeNonSeries: when true, we exclude both 'Série' and "Série d'animation" (for films/others)
    let categoryEq: string | null = null;
    let excludeSeries = false;
    if (catParam) {
      const lower = catParam.toLowerCase();
      if (lower === 'serie') {
        categoryEq = 'Série';
      } else if (lower === 'films') {
        excludeSeries = true;
      } else {
        // Use the provided exact category label
        categoryEq = catParam;
      }
    } else {
      const baseCat = baseRows[0]?.categorie || '';
      if (baseCat === 'Série' || baseCat === "Série d'animation") {
        categoryEq = baseCat;
      } else {
        excludeSeries = true;
      }
    }

    const baseGenresRaw = baseRows[0]?.genres || '';
    const baseGenres = baseGenresRaw
      .split(',')
      .map(g => g.trim())
      .filter(g => g.length > 0)
      .slice(0, 6); // limit number of LIKEs

    // Build WHERE filters
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (categoryEq) {
      where += ' AND categorie = ?';
      params.push(categoryEq);
    } else if (excludeSeries) {
      where += " AND categorie NOT IN ('Série','Série d''animation')";
    }

    // Exclude same title
    where += ' AND title <> ?';
    params.push(title);

    // Genre overlap if we have any
    if (baseGenres.length > 0) {
      const likes = baseGenres.map(() => 'genres LIKE ?').join(' OR ');
      where += ` AND (${likes})`;
      params.push(...baseGenres.map(g => `%${g}%`));
    }

    // First, select representative ids per title ordered by latest release_date
    const [idRows] = await pool.query<RowDataPacket[]>(
      `SELECT MIN(id) as id, title, MAX(release_date) as last_date
       FROM ygg_torrents_new
       ${where}
       GROUP BY title
       ORDER BY last_date DESC
       LIMIT ?`,
      [...params, limit]
    );

    if (!Array.isArray(idRows) || idRows.length === 0) {
      // Fallback: return latest in same category if genre-based is empty
      // Build fallback WHERE similarly
      let fbWhere = 'WHERE 1=1';
      const fbParams: any[] = [];
      if (categoryEq) {
        fbWhere += ' AND categorie = ?';
        fbParams.push(categoryEq);
      } else if (excludeSeries) {
        fbWhere += " AND categorie NOT IN ('Série','Série d''animation')";
      }
      fbWhere += ' AND title <> ?';
      fbParams.push(title);

      const [fallbackRows] = await pool.query<RowDataPacket[]>(
        `SELECT MIN(id) as id, title, MAX(release_date) as last_date
         FROM ygg_torrents_new
         ${fbWhere}
         GROUP BY title
         ORDER BY last_date DESC
         LIMIT ?`,
        [...fbParams, limit]
      );

      if (!Array.isArray(fallbackRows) || fallbackRows.length === 0) {
        return new Response(JSON.stringify({ recommendations: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const ids = (fallbackRows as any[]).map(r => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const [rows] = await pool.query<RecRow[]>(
        `SELECT id, title, year, poster_url, genres, overview, release_date, categorie
         FROM ygg_torrents_new
         WHERE id IN (${placeholders})`,
        ids
      );

      return new Response(JSON.stringify({ recommendations: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ids = (idRows as any[]).map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query<RecRow[]>(
      `SELECT id, title, year, poster_url, genres, overview, release_date, categorie
       FROM ygg_torrents_new
       WHERE id IN (${placeholders})`,
      ids
    );

    return new Response(JSON.stringify({ recommendations: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch recommendations' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
