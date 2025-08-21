import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, FieldPacket } from 'mysql2';

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
        `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new WHERE categorie IN ('Film', 'Film d''animation')`
      );
      return new Response(JSON.stringify({ total: countResult[0]?.total || 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Récupérer les paramètres de filtrage et de tri
    const q = searchParams.get('q') || '';
    const genre = searchParams.get('genre') || '';
    const startYear = searchParams.get('startYear');
    const endYear = searchParams.get('endYear');
    const sort = searchParams.get('sort') || 'latest';

    // Construire la requête avec filtrage
    // IMPORTANT: utiliser IN pour éviter les problèmes de précédence entre OR et AND
    let whereClause = "WHERE categorie IN ('Film', 'Film d''animation')";
    const params: any[] = [];

    // Ajouter les conditions de filtrage
    if (q) {
      whereClause += " AND title LIKE ?";
      params.push(`%${q}%`);
    }

    if (genre) {
      whereClause += " AND genres LIKE ?";
      params.push(`%${genre}%`);
    }

    if (startYear && endYear) {
      whereClause += " AND year BETWEEN ? AND ?";
      params.push(startYear, endYear);
    }

    // Déterminer l'ordre de tri
    let orderBy = "";
    switch (sort) {
      case 'oldest':
        orderBy = "release_date ASC";
        break;
      case 'title_asc':
        orderBy = "title ASC";
        break;
      case 'title_desc':
        orderBy = "title DESC";
        break;
      case 'latest':
      default:
        orderBy = "release_date DESC";
        break;
    }

    // D'abord, obtenir le nombre total de résultats pour la pagination
    const [countResult] = await pool.query<CountResult[]>(
      `SELECT COUNT(DISTINCT title) as total FROM ygg_torrents_new ${whereClause}`,
      params
    );

    // Ensuite, obtenir les films avec pagination
    // D'abord, obtenir les IDs des films triés selon les critères
    const sortField = orderBy.split(' ')[0];
    const sortDirection = orderBy.split(' ')[1] || 'DESC';
    
    // Requête pour obtenir les IDs triés
    const [sortedIds] = await pool.query<RowDataPacket[]>(
      `SELECT MIN(id) as id 
       FROM ygg_torrents_new 
       ${whereClause} 
       GROUP BY title 
       ORDER BY ${sortField === 'title' ? 'title' : 'MAX(release_date)'} ${sortDirection}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as [RowDataPacket[], FieldPacket[]];
    
    // Si aucun résultat, retourner un tableau vide
    if (sortedIds.length === 0) {
      return new Response(JSON.stringify({
        movies: [],
        total: countResult[0]?.total || 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Ensuite, obtenir les détails complets des films
    // Créer une liste des IDs pour la clause IN
    const idList = sortedIds.map(item => (item as any).id);
    const placeholders = idList.map(() => '?').join(',');
    
    // Construire la requête avec une jointure pour éviter le GROUP BY problématique
    const [rows] = await pool.query<MovieRow[]>(
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
