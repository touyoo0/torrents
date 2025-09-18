import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, FieldPacket } from 'mysql2';

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

// This endpoint now ignores any user/IP data and simply returns the latest
// distinct titles by created_at.

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const countOnly = searchParams.get('count') === 'true';
    const categorie = (searchParams.get('categorie') || '').toLowerCase();

    // Where clause purely based on categorie, no date/cutoff constraint
    let whereClause = 'WHERE 1=1';
    if (categorie === 'movies') {
      whereClause += " AND categorie != 'Série'";
    } else if (categorie === 'series') {
      whereClause += " AND categorie = 'Série'";
    }

    // Count semantics: we always expose 25 per category; without categorie return 50 (25 films + 25 séries)
    if (countOnly) {
      const total = categorie === 'movies' || categorie === 'series' ? 25 : 50;
      return new Response(JSON.stringify({ total }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get latest distinct titles by created_at (most recent entry per title)
    const [sortedIds] = await pool.query<RowDataPacket[]>(
      `SELECT MIN(id) as id
       FROM ygg_torrents_new
       ${whereClause}
       GROUP BY title
       ORDER BY MAX(created_at) DESC
       LIMIT ?`,
      [limit]
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

    // Total equals the number requested (limit) or the number of rows found
    const total = Math.min(limit, rows.length);

    return new Response(JSON.stringify({ items: rows, total }), {
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
