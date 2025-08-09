"use client";
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { FiMenu, FiX } from 'react-icons/fi';

export default function Navigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = searchParams?.get('from');
  const [free, setFree] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [nouveautesCount, setNouveautesCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/disk-space")
      .then((res) => res.json())
      .then((data) => {
        if (data.free && data.total) {
          setFree(Number(data.free));
          setTotal(Number(data.total));
        } else {
          setError(data.error || "Erreur inconnue");
        }
      })
      .catch(() => setError("Impossible de récupérer l'espace disque"));
  }, []);

  // Fetch total count of nouveautés (films + séries)
  useEffect(() => {
    let aborted = false;
    fetch('/api/nouveautes?count=true')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('bad status')))
      .then((data) => {
        if (!aborted) {
          const n = typeof data?.total === 'number' ? data.total : 0;
          setNouveautesCount(n);
        }
      })
      .catch(() => {
        if (!aborted) setNouveautesCount(null);
      });
    return () => {
        aborted = true;
    };
  }, []);

  // Listen for client-side updates to nouveautés count (e.g., after 'Marquer comme lu')
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { count?: number } | undefined;
        if (detail && typeof detail.count === 'number') {
          setNouveautesCount(detail.count);
        } else {
          setNouveautesCount(0);
        }
      } catch {
        setNouveautesCount(0);
      }
    };
    window.addEventListener('nouveautes:updated', handler as EventListener);
    return () => window.removeEventListener('nouveautes:updated', handler as EventListener);
  }, []);

  let percent = 0;
  if (free !== null && total !== null && total > 0) {
    percent = (free / total) * 100;
  }
  
  const isActive = (path: string) => {
    // If we navigated from Nouveautés, keep Nouveautés tab active
    // and prevent Films/Séries from being marked active even on their subroutes.
    if (from === 'nouveautes') {
      if (path === '/nouveautes') return true;
      if (path === '/movies' || path === '/series') return false;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-black shadow-lg border-b border-gray-800">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Navigation desktop et logo mobile */}
        <div className="flex items-center">
          <span className="text-lg font-bold text-white italic md:hidden">MENU</span>
          <div className="hidden md:flex space-x-6 ml-0">
            <NavLink href="/" active={isActive('/')}>
              Accueil
            </NavLink>
            <NavLink href="/nouveautes" active={isActive('/nouveautes')}>
              <span className="inline-flex items-center">
                Nouveautés
                {typeof nouveautesCount === 'number' && nouveautesCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 text-xs font-semibold rounded-full bg-blue-600 text-white">
                    {nouveautesCount > 99 ? '99+' : nouveautesCount}
                  </span>
                )}
              </span>
            </NavLink>
            <NavLink href="/movies" active={isActive('/movies')}>
              Films
            </NavLink>
            <NavLink href="/series" active={isActive('/series')}>
              Séries
            </NavLink>
            <NavLink href="/telechargements" active={isActive('/telechargements')}>
              Téléchargements
            </NavLink>
          </div>
        </div>
        
        {/* Disk Space Info - Desktop */}
        <div className="hidden md:flex text-sm text-gray-300 items-center">
          {free === null || total === null ? (
            error ? (
              // Valeurs fictives en cas d'erreur
              <div className="flex items-center">
                <div className="mr-3">
                  <span className="font-medium">200 Go</span> libres 
                  <span className="text-gray-400 text-xs"> (20%)</span>
                </div>
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '20%' }} />
                </div>
              </div>
            ) : (
              <span className="text-gray-400">Chargement...</span>
            )
          ) : (
            <div className="flex items-center">
              <div className="mr-3">
                <span className="font-medium">{free < 1 ? free.toFixed(1) : Math.round(free)} Go</span> libres 
                <span className="text-gray-400 text-xs"> ({Math.round(percent)}%)</span>
              </div>
              <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${percent > 20 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bouton menu mobile */}
        <button 
          className="md:hidden text-white focus:outline-none" 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>

        {/* Menu mobile */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-black border-b border-gray-800 shadow-lg md:hidden">
            <div className="container mx-auto px-4 py-3">
              <div className="flex flex-col space-y-4 pb-4">
                <MobileNavLink href="/" active={isActive('/')} onClick={() => setIsMenuOpen(false)}>
                  Accueil
                </MobileNavLink>
                <MobileNavLink href="/nouveautes" active={isActive('/nouveautes')} onClick={() => setIsMenuOpen(false)}>
                  <span className="inline-flex items-center">
                    Nouveautés
                    {typeof nouveautesCount === 'number' && nouveautesCount > 0 && (
                      <span className="ml-2 flex items-center justify-center w-7 h-7 text-sm font-semibold rounded-full bg-blue-600 text-white">
                        {nouveautesCount > 99 ? '99+' : nouveautesCount}
                      </span>
                    )}
                  </span>
                </MobileNavLink>
                <MobileNavLink href="/movies" active={isActive('/movies')} onClick={() => setIsMenuOpen(false)}>
                  Films
                </MobileNavLink>
                <MobileNavLink href="/series" active={isActive('/series')} onClick={() => setIsMenuOpen(false)}>
                  Séries
                </MobileNavLink>
                <MobileNavLink href="/telechargements" active={isActive('/telechargements')} onClick={() => setIsMenuOpen(false)}>
                  Téléchargements
                </MobileNavLink>
                
                {/* Disk Space Info - Mobile */}
                <div className="text-sm text-gray-300 pt-2 border-t border-gray-800">
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-2 mt-2">Espace disque</p>
                  {free === null || total === null ? (
                    error ? (
                      // Valeurs fictives en cas d'erreur sur mobile
                      <div className="flex flex-col">
                        <div className="mb-2">
                          <span className="font-medium">200 Go</span> libres 
                          <span className="text-gray-400 text-xs"> (20%)</span>
                        </div>
                        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: '20%' }} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Chargement...</span>
                    )
                  ) : (
                    <div className="flex flex-col">
                      <div className="mb-2">
                        <span className="font-medium">{free < 1 ? free.toFixed(1) : Math.round(free)} Go</span> libres 
                        <span className="text-gray-400 text-xs"> ({Math.round(percent)}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${percent > 20 ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative">
      <span className={`text-lg font-medium ${active ? 'text-white' : 'text-gray-300 hover:text-white transition-colors'}`}>
        {children}
      </span>
      {active && (
        <motion.div
          layoutId="navigation-underline"
          className="absolute bottom-[-4px] left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </Link>
  );
}

function MobileNavLink({ href, active, children, onClick }: { href: string; active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} className="block py-2" onClick={onClick}>
      <span className={`text-lg font-medium ${active ? 'text-white' : 'text-gray-300'}`}>
        <span className="mr-1">&gt;</span>{children}
      </span>
    </Link>
  );
}
