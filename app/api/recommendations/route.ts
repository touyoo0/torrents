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
    const catParam = searchParams.get('categorie'); // 'films' | 'serie' | undefined
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

    let targetCategorie: 'Série' | 'FilmOuAutre' = 'FilmOuAutre';
    if (catParam === 'serie') targetCategorie = 'Série';
    else if (catParam === 'films') targetCategorie = 'FilmOuAutre';
    else if (baseRows[0]?.categorie === 'Série') targetCategorie = 'Série';

    const baseGenresRaw = baseRows[0]?.genres || '';
    const baseGenres = baseGenresRaw
      .split(',')
      .map(g => g.trim())
      .filter(g => g.length > 0)
      .slice(0, 6); // limit number of LIKEs

    // Build WHERE filters
    let where = '';
    const params: any[] = [];

    if (targetCategorie === 'Série') {
      where += "WHERE categorie = 'Série'";
    } else {
      where += "WHERE categorie != 'Série'";
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
      const [fallbackRows] = await pool.query<RowDataPacket[]>(
        `SELECT MIN(id) as id, title, MAX(release_date) as last_date
         FROM ygg_torrents_new
         ${targetCategorie === 'Série' ? "WHERE categorie = 'Série'" : "WHERE categorie != 'Série'"}
           AND title <> ?
         GROUP BY title
         ORDER BY last_date DESC
         LIMIT ?`,
        [title, limit]
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
