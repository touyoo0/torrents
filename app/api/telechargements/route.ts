import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
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
  repertoire?: string | null;
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!id || Number.isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Paramètre id invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Récupérer le répertoire courant
    const [rows] = await pool.query<TorrentRow[]>(
      'SELECT id, repertoire FROM ygg_torrents_new WHERE id = ? LIMIT 1',
      [id]
    );
    const row: any = Array.isArray(rows) && rows.length ? rows[0] : null;
    const repertoire: string | null = row?.repertoire ?? null;

    if (repertoire && typeof repertoire === 'string' && repertoire.trim().length > 0) {
      try {
        await fs.rm(repertoire, { recursive: true, force: true });
      } catch (e) {
        console.error('Erreur suppression repertoire:', e);
        // On continue malgré tout pour mettre à jour la DB
      }
    }

    await pool.query(
      "UPDATE ygg_torrents_new SET statut = '➕ Ajouter', repertoire = NULL WHERE id = ?",
      [id]
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur API suppression:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
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
       ORDER BY title ASC
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
