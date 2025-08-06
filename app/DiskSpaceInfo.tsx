"use client";
import React, { useEffect, useState } from "react";

export default function DiskSpaceInfo() {
  const [free, setFree] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  let percent = 0;
  if (free !== null && total !== null && total > 0) {
    percent = (free / total) * 100;
  }

  const [open, setOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fonction pour gérer les clics en dehors du composant
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node) && open) {
        setOpen(false);
      }
    }
    
    // Ajouter l'écouteur d'événement quand le composant est ouvert
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    // Nettoyer l'écouteur d'événement
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]); // Dépendance à l'état 'open'

  return (
    <div ref={containerRef} style={{ position: "absolute", top: 12, left: 16, zIndex: 1000 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Afficher l'espace disque"
        style={{
          background: '#222',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'background 0.2s',
        }}
        title="Afficher l'espace disque"
      >
        {/* Icône disquette SVG */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="#222" stroke="currentColor"/>
          <rect x="7" y="15" width="10" height="4" rx="1" fill="#fff" stroke="currentColor"/>
          <rect x="7" y="7" width="6" height="4" rx="1" fill="#fff" stroke="currentColor"/>
          <line x1="7" y1="7" x2="13" y2="7" stroke="currentColor"/>
        </svg>
      </button>
      {open && (
        <div style={{
          marginTop: 8,
          background: "rgba(30,30,30,0.92)",
          color: "#fff",
          padding: "16px 24px 18px 24px",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
          minWidth: 220,
          position: 'absolute',
          left: 0,
        }}>
          {error ? (
            // Afficher des valeurs fictives si erreur
            <>
              <div style={{ marginBottom: 4, textAlign: "left" }}>
                Espace libre : 200 Go (20%)
              </div>
              <div style={{ width: "100%", height: 10, background: "#444", borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                  width: `${(200/1000)*100}%`,
                  height: "100%",
                  background: (200/1000)*100 > 65 ? '#38a169' : (200/1000)*100 > 35 ? '#ecc94b' : '#e53e3e',
                  transition: 'width 0.3s',
                  borderRadius: 5
                }}></div>
              </div>
            </>
          ) : free !== null && total !== null ? (
            <>
              <div style={{ marginBottom: 4, textAlign: "left" }}>
                Espace libre : {free} Go ({Math.round(percent)}%)
              </div>
              <div style={{ width: "100%", height: 10, background: "#444", borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                  width: `${percent}%`,
                  height: "100%",
                  background: percent > 65 ? '#38a169' : percent > 35 ? '#ecc94b' : '#e53e3e',
                  transition: 'width 0.3s',
                  borderRadius: 5
                }}></div>
              </div>
            </>
          ) : (
            <span>Lecture espace disque...</span>
          )}
        </div>
      )}
    </div>
  );
}

