import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  try {
    const { title: rawTitle } = await params;
    const title = decodeURIComponent(rawTitle);

    // Récupérer toutes les séries avec ce titre
    const [rows] = await pool.query(
      "SELECT * FROM ygg_torrents_new WHERE title = ? AND categorie = 'Série' ORDER BY year DESC, created_at DESC",
      [title]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Séries non trouvées' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new NextResponse(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Database error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Erreur lors de la récupération des séries' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
