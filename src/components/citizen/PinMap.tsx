"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PinMapProps {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}

/** Map where the citizen drags a pin to the incident. Tiles from OpenStreetMap (attribution shown). */
export function PinMap({ lat, lng, onMove }: PinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([lat, lng], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onMoveRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onMoveRef.current(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    });
    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Map is created once; later position changes are applied in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const current = marker.getLatLng();
    if (current.lat !== lat || current.lng !== lng) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
    }
  }, [lat, lng]);

  return <div ref={containerRef} className="h-56 w-full border border-line" role="application" aria-label="Pin the incident location on the map" />;
}
