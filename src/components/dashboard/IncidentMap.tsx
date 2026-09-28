"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface Feature {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: { trackingCode: string; severity: string | null; incidentType: string | null; band: string | null; area: string | null };
}

const W = 600;
const H = 300;
const PAD = 30;

/**
 * Sketch-style map: open incidents plotted on a plain grid (no map tiles), scaled to fit.
 * Filled markers = high/critical severity, hollow = everything else. Click to open.
 */
export function IncidentMap({ reload = 0 }: { reload?: number }) {
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ features: Feature[] }>("/api/incidents/map").then((res) => {
      if (!res.ok) return setError(res.error);
      setError(null);
      setFeatures(res.data.features);
    });
  }, [reload]);

  const lngs = features.map((f) => f.geometry.coordinates[0]);
  const lats = features.map((f) => f.geometry.coordinates[1]);
  // Keep a minimum span so a single incident (or a tight cluster) doesn't fill the whole box.
  const span = (xs: number[]) => Math.max(Math.max(...xs) - Math.min(...xs), 0.01);
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const scale = Math.min((W - 2 * PAD) / span(lngs), (H - 2 * PAD) / span(lats));
  const x = (lng: number) => W / 2 + (lng - midLng) * scale;
  const y = (lat: number) => H / 2 - (lat - midLat) * scale;

  return (
    <div className="relative h-full min-h-72">
      <span className="absolute left-2 top-2 z-10 border border-faint bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted">map — severity markers</span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label={`Map of ${features.length} open incidents`}>
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--grid)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {features.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const urgent = f.properties.severity === "high" || f.properties.severity === "critical";
          return (
            <g key={f.id} onClick={() => router.push(`/dashboard/incidents/${f.id}`)} className="cursor-pointer">
              <title>
                {`${f.properties.trackingCode} · ${f.properties.band ?? "unscored"} · ${f.properties.incidentType ?? "unconfirmed"} · ${f.properties.severity ?? "no severity"}${f.properties.area ? ` · ${f.properties.area}` : ""}`}
              </title>
              <circle cx={x(lng)} cy={y(lat)} r={f.properties.band === "P1" ? 10 : 8} fill={urgent ? "var(--foreground)" : "var(--background)"} stroke="var(--foreground)" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
      {features.length === 0 && (
        <p className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-muted">{error ?? "no open incidents to plot"}</p>
      )}
      <span className="absolute bottom-2 right-2 flex items-center gap-3 border border-faint bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground" /> high/critical</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border border-foreground" /> other</span>
      </span>
    </div>
  );
}
