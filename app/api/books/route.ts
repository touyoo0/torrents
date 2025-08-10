import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface BookRow extends RowDataPacket {
  id: number;
  name: string;
  size: string | null;
  created_at: string | null;
  username: string | null;
  repertoire: string | null;
}

interface CountResult extends RowDataPacket {
  total: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const q = searchParams.get('q') || '';

    const params: any[] = [];
    let where = '';
    if (q) {
      where = 'WHERE name LIKE ?';
      params.push(`%${q}%`);
    }

    // total count
    const [countRows] = await pool.query<CountResult[]>(
      `SELECT COUNT(*) AS total FROM ygg_torrents_books ${where}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // data page
    const [rows] = await pool.query<BookRow[]>(
      `SELECT id, name, size, created_at, username, repertoire
       FROM ygg_torrents_books
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return new Response(
      JSON.stringify({ books: rows, total }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error fetching books:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch books' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
