import React from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FiArrowLeft, FiPlay } from 'react-icons/fi';

interface Movie {
  id: number;
  title: string;
  year: string;
  poster_url: string;
  overview: string;
  genres: string;
  release_date: string;
  categorie: string;
  trailer_url?: string;
  size?: string;
  created_at?: string;
}

async function getMovie(id: string): Promise<Movie | null> {
  try {
    const res = await fetch(`http://localhost:3000/api/movies/${id}`);
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('Error fetching movie:', error);
    return null;
  }
}

export default async function MoviePage({ params }: { params: { id: string } }) {
  const id = params.id;
  const movie = await getMovie(id);
  if (!movie) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white p-8">
      <Link href="/movies" className="flex items-center text-slate-300 hover:text-white mb-8">
        <FiArrowLeft className="mr-2" /> Retour aux films
      </Link>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Affiche du film */}
        <div className="lg:col-span-1">
          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-slate-800">
            {movie.poster_url ? (
              <Image
                src={movie.poster_url}
                alt={movie.title}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-4xl text-slate-500">🎬</div>
              </div>
            )}
          </div>
          
          {movie.trailer_url && (
            <a
              href={movie.trailer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
            >
              <FiPlay className="text-lg" /> Regarder la bande-annonce
            </a>
          )}
        </div>
        
        {/* Détails du film */}
        <div className="lg:col-span-2">
          <h1 className="text-4xl font-bold mb-2">
            {movie.title} {movie.year && `(${movie.year})`}
          </h1>
          
          <div className="flex flex-wrap gap-2 my-4">
            {movie.genres?.split(',').map((genre, i) => (
              <span 
                key={i}
                className="inline-block bg-white/10 text-white/80 text-xs px-3 py-1 rounded-full"
              >
                {genre.trim()}
              </span>
            ))}
          </div>
          
          {movie.overview && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-2">Synopsis</h2>
              <p className="text-slate-300">{movie.overview}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
