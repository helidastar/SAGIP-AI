"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PinMapProps {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}

// A drawn pin instead of Leaflet's default marker image, which does not load under the Next.js bundler.
const pinIcon = L.divIcon({
  className: "",
  html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c62828;border:3px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / 45%)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

const round = (n: number) => Number(n.toFixed(6));

/**
 * Map under "Where is it?": shows the pin at the detected or typed location. The citizen can
 * drag the pin or tap the map to correct it. Street tiles from OpenStreetMap (credit shown).
 */
export function PinMap({ lat, lng, onMove }: PinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  // Create the map once; position changes are applied by the effect below.
  const start = useRef({ lat, lng });
  useEffect(() => {
    if (!containerRef.current) return;
    const { lat: lat0, lng: lng0 } = start.current;
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([lat0, lng0], 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    const marker = L.marker([lat0, lng0], { draggable: true, icon: pinIcon, title: "Incident location" }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onMoveRef.current(round(p.lat), round(p.lng));
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onMoveRef.current(round(e.latlng.lat), round(e.latlng.lng));
    });
    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const current = marker.getLatLng();
    if (round(current.lat) !== round(lat) || round(current.lng) !== round(lng)) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: false });
    }
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className="relative z-0 mt-3 h-56 w-full overflow-hidden rounded border border-cz-border"
      role="application"
      aria-label="Map of the incident location. Drag the pin or tap the map to move it."
    />
  );
}
