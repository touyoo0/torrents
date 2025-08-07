import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface TorrentRow extends RowDataPacket {
  id: number;
  title: string;
  name: string;
  year: string;
  poster_url: string;
  genres: string;
  statut: string;
  categorie: string;
  saison: number | null;
  episode: number | null;
}

export async function GET(req: NextRequest) {
  try {
    // Statuts à inclure
    const statuts = ["✔️ Téléchargé", "⌛ Téléchargement"];
    const { searchParams } = new URL(req.url);
    const categorie = searchParams.get('categorie');

    let whereClause = 'WHERE statut IN (?, ?)';
    const params: any[] = [...statuts];
    if (categorie === 'serie') {
      whereClause += " AND categorie = 'Série'";
    } else if (categorie === 'films') {
      whereClause += " AND categorie != 'Série'";
    }

    const [rows] = await pool.query<TorrentRow[]>(
      `SELECT id, title, name, year, poster_url, genres, statut, categorie, saison, episode
       FROM ygg_torrents_new
       ${whereClause}
       ORDER BY id DESC
       LIMIT 200`,
      params
    );
    return new Response(JSON.stringify({ torrents: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur API téléchargés:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
