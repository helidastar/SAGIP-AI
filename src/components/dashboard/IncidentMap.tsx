"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { stepFor } from "@/lib/workflow";
import type { Severity } from "@/types";

interface Feature {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: {
    trackingCode: string;
    severity: Severity | null;
    incidentType: string | null;
    band: string | null;
    area: string | null;
    status: string;
  };
}

type MapStatus = "loading" | "ready" | "error";
type MapLoadResult =
  | { key: string; state: "ready"; features: Feature[] }
  | { key: string; state: "error"; error: string };

const WIDTH = 640;
const HEIGHT = 420;
const PADDING = 42;
const EMPTY_FEATURES: Feature[] = [];

export function IncidentMap({
  reload = 0,
  forceError = false,
  forceLoading = false,
}: {
  reload?: number;
  forceError?: boolean;
  forceLoading?: boolean;
}) {
  const router = useRouter();
  const [loadResult, setLoadResult] = useState<MapLoadResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [dismissedPreviewError, setDismissedPreviewError] = useState(false);
  const requestKey = `${reload}:${retryCount}`;

  useEffect(() => {
    let cancelled = false;
    void api<{ features: Feature[] }>("/api/incidents/map").then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadResult({
          key: requestKey,
          state: "error",
          error: result.error ?? "Could not load map data",
        });
        return;
      }
      setLoadResult({ key: requestKey, state: "ready", features: result.data.features });
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const currentResult = loadResult?.key === requestKey ? loadResult : null;
  const features = currentResult?.state === "ready" ? currentResult.features : EMPTY_FEATURES;
  const error = currentResult?.state === "error" ? currentResult.error : null;
  const usableFeatures = useMemo(
    () =>
      features.filter((feature) =>
        feature.geometry.coordinates.every(Number.isFinite),
      ),
    [features],
  );
  const bounds = useMemo(() => {
    if (usableFeatures.length === 0) return null;
    const longitudes = usableFeatures.map((feature) => feature.geometry.coordinates[0]);
    const latitudes = usableFeatures.map((feature) => feature.geometry.coordinates[1]);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    return {
      midLng: (minLng + maxLng) / 2,
      midLat: (minLat + maxLat) / 2,
      spanLng: Math.max(maxLng - minLng, 0.01),
      spanLat: Math.max(maxLat - minLat, 0.01),
    };
  }, [usableFeatures]);
  const scale = bounds
    ? Math.min((WIDTH - PADDING * 2) / bounds.spanLng, (HEIGHT - PADDING * 2) / bounds.spanLat) * zoom
    : 1;
  const mapError = forceError && !dismissedPreviewError ? "Map telemetry connection degraded" : error;
  const mapStatus: MapStatus = forceLoading
    ? "loading"
    : mapError
      ? "error"
      : currentResult?.state ?? "loading";

  function retryMap() {
    setDismissedPreviewError(true);
    setRetryCount((count) => count + 1);
  }

  function coordinatesFor(longitude: number, latitude: number) {
    if (!bounds) return { x: WIDTH / 2, y: HEIGHT / 2 };
    return {
      x: WIDTH / 2 + (longitude - bounds.midLng) * scale,
      y: HEIGHT / 2 - (latitude - bounds.midLat) * scale,
    };
  }

  return (
    <section className="dashboard-map-panel" aria-labelledby="incident-map-title">
      <header className="dashboard-map-heading">
        <span className="dashboard-map-heading-icon" aria-hidden="true">
          <MapIcon />
        </span>
        <h2 id="incident-map-title">Incident Map <span>•</span> Severity Markers</h2>
        <span className="dashboard-map-heading-spacer" />
        <span className="dashboard-map-count">
          <span className="dashboard-map-active" aria-hidden="true" />
          {usableFeatures.length} incidents
        </span>
      </header>
      <div
        className={`dashboard-map-canvas ${mapStatus === "error" ? "has-error" : ""}`}
        aria-busy={mapStatus === "loading"}
      >
        {mapStatus === "loading" ? (
          <div className="dashboard-map-loading" role="status">
            <span className="dashboard-map-loading-surface" aria-hidden="true" />
            <span>Synchronizing Barangay Spatial Mesh...</span>
          </div>
        ) : mapStatus === "error" ? (
          <div className="dashboard-map-error" role="alert">
            <span className="dashboard-map-error-icon" aria-hidden="true">
              <MapErrorIcon />
            </span>
            <h3>{mapError}</h3>
            <p>
              The incident map data could not be loaded. The ranked incident list
              and review queue remain available.
            </p>
            <div className="dashboard-map-error-actions">
              <button type="button" className="dashboard-primary-button" onClick={retryMap}>
                Retry Map
              </button>
              {error && <span className="dashboard-map-error-code">Error: {error}</span>}
            </div>
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="xMidYMid slice"
              className="dashboard-map-svg"
              role="group"
              aria-label={`Map of ${usableFeatures.length} open incidents`}
            >
              <defs>
                <pattern id="dashboard-map-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M 36 0 L 0 0 0 36" fill="none" stroke="var(--dashboard-map-grid)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={WIDTH} height={HEIGHT} fill="var(--dashboard-map-land)" />
              <rect width={WIDTH} height={HEIGHT} fill="url(#dashboard-map-grid)" />
              {usableFeatures.length > 0 && bounds && (
                <g>
                  {usableFeatures.map((feature) => {
                    const [longitude, latitude] = feature.geometry.coordinates;
                    const point = coordinatesFor(longitude, latitude);
                    const band = feature.properties.band ?? "—";
                    const severity = feature.properties.severity ?? "unconfirmed";
                    const severityMarker = severity === "unconfirmed" ? "?" : severity.slice(0, 1).toUpperCase();
                    const workflow = stepFor(feature.properties.status)?.next ?? feature.properties.status;
                    return (
                      <g
                        key={feature.id}
                        className="dashboard-map-marker-link"
                        role="link"
                        tabIndex={0}
                        aria-label={`${band} priority, ${severity} severity, ${feature.properties.incidentType ?? "unconfirmed incident"}, ${feature.properties.trackingCode}, ${feature.properties.area ?? "unknown area"}, ${workflow}`}
                        onClick={() => router.push(`/dashboard/incidents/${feature.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/dashboard/incidents/${feature.id}`);
                          }
                        }}
                      >
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={band === "P1" ? 14 : 11}
                          className={`dashboard-map-marker marker-${severity}`}
                        />
                        <text x={point.x} y={point.y + 3.5} className="dashboard-map-marker-label">
                          {severityMarker}
                        </text>
                        <title>
                          {`${feature.properties.trackingCode} · ${band} · ${severity} · ${workflow}`}
                        </title>
                      </g>
                    );
                  })}
                </g>
              )}
            </svg>
            <div className="dashboard-map-controls" role="group" aria-label="Map controls">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))}
                aria-label="Zoom map in"
              >+</button>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(0.8, value - 0.2))}
                aria-label="Zoom map out"
              >−</button>
            </div>
            {usableFeatures.length === 0 && (
              <p className="dashboard-map-no-markers">No open incidents to plot</p>
            )}
          </>
        )}
        {mapStatus === "ready" && <MapLegend />}
      </div>
    </section>
  );
}

export function MapLegend() {
  return (
    <div className="dashboard-map-legend" role="group" aria-label="Map severity legend">
      <strong>Severity legend</strong>
      <span className="dashboard-map-legend-version">v2.4</span>
      <ul>
        <li><span className="dashboard-legend-marker marker-critical" aria-hidden="true">C</span> Critical</li>
        <li><span className="dashboard-legend-marker marker-high" aria-hidden="true">H</span> High</li>
        <li><span className="dashboard-legend-marker marker-moderate" aria-hidden="true">M</span> Moderate</li>
        <li><span className="dashboard-legend-marker marker-low" aria-hidden="true">L</span> Low</li>
      </ul>
    </div>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="m2 4 5-2 6 2 5-2v14l-5 2-6-2-5 2V4Z" />
      <path d="M7 2v14m6-12v14" />
    </svg>
  );
}

function MapErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M5 5a8.5 8.5 0 1 1-1 10m1-10 5 1M5 5l-.5 5" />
      <path d="m9 9 6 6m0-6-6 6" />
    </svg>
  );
}
