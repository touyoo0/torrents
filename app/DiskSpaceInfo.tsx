"use client";
import React, { useEffect, useState } from "react";

export default function DiskSpaceInfo() {
  const [free, setFree] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/disk-space")
      .then((res) => res.json())
      .then((data) => {
        if (data.free) setFree(data.free);
        else setError(data.error || "Erreur inconnue");
      })
      .catch(() => setError("Impossible de récupérer l'espace disque"));
  }, []);

  return (
    <div style={{ position: "fixed", top: 12, left: 16, zIndex: 1000, background: "rgba(30,30,30,0.85)", color: "#fff", padding: "6px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}>
      {error ? (
        <span style={{ color: "#ff6666" }}>Disque: {error}</span>
      ) : free ? (
        <span>Disque: {free} libres</span>
      ) : (
        <span>Lecture espace disque...</span>
      )}
    </div>
  );
}
