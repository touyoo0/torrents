import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface CountResult extends RowDataPacket {
  total: number;
}

interface MovieRow extends RowDataPacket {
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
    const limit = parseInt(searchParams.get('limit') || '20', 10); // Limite réduite pour améliorer les performances
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const countOnly = searchParams.get('count') === 'true';
    
    // Si on demande uniquement le nombre total de films
    if (countOnly) {
      const [countResult] = await pool.query<CountResult[]>(
        `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new WHERE categorie != 'Série'`
      );
      return new Response(JSON.stringify({ total: countResult[0]?.total || 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Utiliser une sous-requête pour obtenir les titres uniques avec pagination
    const [rows] = await pool.query<MovieRow[]>(
      `WITH RankedMovies AS (
        SELECT 
          title,
          MIN(id) as id,
          COUNT(*) as count,
          MAX(year) as year,
          MAX(poster_url) as poster_url,
          MAX(genres) as genres,
          MAX(overview) as overview,
          MAX(release_date) as release_date,
          MAX(categorie) as categorie,
          ROW_NUMBER() OVER (ORDER BY MAX(release_date) DESC) as row_num
        FROM ygg_torrents_new 
        WHERE categorie != 'Série' 
        GROUP BY title
      )
      SELECT 
        title, id, count, year, poster_url, genres, overview, release_date, categorie
      FROM RankedMovies
      WHERE row_num > ? AND row_num <= ? + ?
      ORDER BY release_date DESC`,
      [offset, offset, limit]
    );
    
    // Obtenir le nombre total de films pour la pagination
    const [countResult] = await pool.query<CountResult[]>(
      `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new WHERE categorie != 'Série'`
    );
    
    return new Response(JSON.stringify({
      movies: rows,
      total: countResult[0]?.total || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch movies' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
