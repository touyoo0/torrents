import { NextRequest } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const [rows] = await pool.query(
      `SELECT id, info_hash, name, size, created_at, title, year, poster_url, genres, trailer_url, overview, statut, categorie, release_date, saison, episode FROM ygg_torrents_new WHERE categorie != 'Série' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

