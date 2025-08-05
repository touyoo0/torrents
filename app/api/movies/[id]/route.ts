import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const [rows] = await pool.query(
      'SELECT * FROM ygg_torrents_new WHERE id = ?',
      [id]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Film non trouvé' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new NextResponse(JSON.stringify(rows[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Database error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Erreur lors de la récupération du film' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
