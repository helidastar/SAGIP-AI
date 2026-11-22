"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./IncidentDossier.module.css";

interface DossierMiniMapProps {
  lat: number;
  lng: number;
  area: string | null;
  openMapUrl: string;
}

export function DossierMiniMap({ lat, lng, area, openMapUrl }: DossierMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const validCoords = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!validCoords || !containerRef.current) return;
    let active = true;
    let mapInstance: import("leaflet").Map | null = null;

    void import("leaflet").then((leaflet) => {
      if (!active || !containerRef.current) return;

      const map = leaflet.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView([lat, lng], 15);

      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        })
        .addTo(map);

      const redPin = leaflet.divIcon({
        className: "",
        html: '<span style="display:block;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#dc2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.45)"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 20],
      });

      leaflet.marker([lat, lng], { icon: redPin, title: area ?? "Incident location" }).addTo(map);
      mapInstance = map;
      window.setTimeout(() => map.invalidateSize(), 120);
    });

    return () => {
      active = false;
      mapInstance?.remove();
    };
  }, [lat, lng, area, validCoords]);

  if (!validCoords) {
    return (
      <div className={styles.miniMapFallback} role="status">
        <span>Location coordinates unavailable</span>
      </div>
    );
  }

  return (
    <div className={styles.miniMapBox}>
      <div
        ref={containerRef}
        className={styles.miniMapCanvas}
        role="img"
        aria-label={`Incident location map for ${area ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`}`}
      />
      <a className={styles.mapOpenPill} href={openMapUrl} target="_blank" rel="noreferrer">
        Open map
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </div>
  );
}
