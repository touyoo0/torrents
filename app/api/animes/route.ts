import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, FieldPacket } from 'mysql2';

interface CountResult extends RowDataPacket {
  total: number;
}

interface AnimeRow extends RowDataPacket {
  id: number;
  title: string;
  count: number;
  year: string;
  poster_url: string;
  genres: string;
  overview: string;
  release_date: string;
  categorie: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const countOnly = searchParams.get('count') === 'true';

    // Count only
    if (countOnly) {
      const [countResult] = await pool.query<CountResult[]>(
        `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new WHERE categorie = 'Série d''animation'`
      );
      return new Response(JSON.stringify({ total: countResult[0]?.total || 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filters and sorting
    const q = searchParams.get('q') || '';
    const genre = searchParams.get('genre') || '';
    const startYear = searchParams.get('startYear');
    const endYear = searchParams.get('endYear');
    const sort = searchParams.get('sort') || 'latest';

    // Base where clause: only anime series by exact SQL category
    let whereClause = "WHERE categorie = 'Série d''animation'";
    const params: any[] = [];

    if (q) {
      whereClause += ' AND title LIKE ?';
      params.push(`%${q}%`);
    }

    if (genre) {
      whereClause += ' AND genres LIKE ?';
      params.push(`%${genre}%`);
    }

    if (startYear && endYear) {
      whereClause += ' AND year BETWEEN ? AND ?';
      params.push(startYear, endYear);
    }

    let orderBy = '';
    switch (sort) {
      case 'oldest':
        orderBy = 'release_date ASC';
        break;
      case 'title_asc':
        orderBy = 'title ASC';
        break;
      case 'title_desc':
        orderBy = 'title DESC';
        break;
      case 'latest':
      default:
        orderBy = 'release_date DESC';
        break;
    }

    const [countResult] = await pool.query<CountResult[]>(
      `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new ${whereClause}`,
      params
    );

    const sortField = orderBy.split(' ')[0];
    const sortDirection = orderBy.split(' ')[1] || 'DESC';

    const [sortedIds] = await pool.query<RowDataPacket[]>(
      `SELECT MIN(id) as id 
       FROM ygg_torrents_new 
       ${whereClause} 
       GROUP BY title 
       ORDER BY ${sortField === 'title' ? 'title' : 'MAX(release_date)'} ${sortDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as [RowDataPacket[], FieldPacket[]];

    if (sortedIds.length === 0) {
      return new Response(
        JSON.stringify({ animes: [], total: countResult[0]?.total || 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const idList = sortedIds.map((item) => (item as any).id);
    const placeholders = idList.map(() => '?').join(',');

    const [rows] = await pool.query<AnimeRow[]>(
      `SELECT 
        t1.title, 
        t1.id, 
        (SELECT COUNT(*) FROM ygg_torrents_new t2 WHERE t2.title = t1.title) as count,
        t1.year,
        t1.poster_url,
        t1.genres,
        t1.overview,
        t1.release_date,
        t1.categorie
      FROM ygg_torrents_new t1
      WHERE t1.id IN (${placeholders})
      ORDER BY ${orderBy}`,
      [...idList]
    );

    return new Response(
      JSON.stringify({ animes: rows, total: countResult[0]?.total || 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching animes:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch animes' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
