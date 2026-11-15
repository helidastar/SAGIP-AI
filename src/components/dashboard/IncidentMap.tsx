"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import styles from "@/components/dashboard/Dashboard.module.css";

interface MapFeature {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: {
    trackingCode: string;
    severity: string | null;
    incidentType: string | null;
    band: string | null;
    area: string | null;
  };
}

type MapStatus = "loading" | "ready" | "error";
type MapResult =
  | { key: string; status: "ready"; features: MapFeature[] }
  | { key: string; status: "error"; error: string };

const WIDTH = 600;
const HEIGHT = 360;
const PADDING = 30;
const EMPTY_FEATURES: MapFeature[] = [];

export function IncidentMap({
  reload,
  selectedId,
  onSelect,
  forceLoading = false,
  forceError = false,
}: {
  reload: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  forceLoading?: boolean;
  forceError?: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<MapResult | null>(null);
  const [retry, setRetry] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [dismissedPreviewError, setDismissedPreviewError] = useState(false);
  const requestKey = `${reload}:${retry}`;

  useEffect(() => {
    let cancelled = false;
    void api<{ features: MapFeature[] }>("/api/incidents/map").then((response) => {
      if (cancelled) return;
      if (!response.ok) {
        setResult({
          key: requestKey,
          status: "error",
          error: response.error ?? "Could not load map data",
        });
        return;
      }
      setResult({ key: requestKey, status: "ready", features: response.data.features });
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const currentResult = result?.key === requestKey ? result : null;
  const features = currentResult?.status === "ready" ? currentResult.features : EMPTY_FEATURES;
  const invalidFeature = features.some((feature) => {
    const [longitude, latitude] = feature.geometry.coordinates;
    return !Number.isFinite(longitude) || !Number.isFinite(latitude) ||
      longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90;
  });
  const validFeatures = useMemo(
    () => features.filter((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return Number.isFinite(longitude) && Number.isFinite(latitude) &&
        longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
    }),
    [features],
  );
  const bounds = useMemo(() => {
    if (validFeatures.length === 0) return null;
    const longitudes = validFeatures.map((feature) => feature.geometry.coordinates[0]);
    const latitudes = validFeatures.map((feature) => feature.geometry.coordinates[1]);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    return {
      centerLng: (minLng + maxLng) / 2,
      centerLat: (minLat + maxLat) / 2,
      spanLng: Math.max(maxLng - minLng, 0.01),
      spanLat: Math.max(maxLat - minLat, 0.01),
    };
  }, [validFeatures]);
  const scale = bounds
    ? Math.min((WIDTH - PADDING * 2) / bounds.spanLng, (HEIGHT - PADDING * 2) / bounds.spanLat) * zoom
    : 1;
  const previewError = forceError && !dismissedPreviewError;
  const status: MapStatus = forceLoading
    ? "loading"
    : previewError || invalidFeature
      ? "error"
      : currentResult?.status ?? "loading";
  const mapError = previewError
    ? "Map telemetry connection degraded"
    : invalidFeature
      ? "Map coordinates are invalid"
      : currentResult?.status === "error"
        ? currentResult.error
        : null;

  function retryMap() {
    setDismissedPreviewError(true);
    setRetry((count) => count + 1);
  }

  function pointFor(longitude: number, latitude: number) {
    if (!bounds) return { x: WIDTH / 2, y: HEIGHT / 2 };
    return {
      x: WIDTH / 2 + (longitude - bounds.centerLng) * scale,
      y: HEIGHT / 2 - (latitude - bounds.centerLat) * scale,
    };
  }

  return (
    <section className={styles.mapPanel} aria-labelledby="incident-map-title">
      <header className={styles.mapHeading}>
        <span className={styles.mapIcon} aria-hidden="true"><MapIcon /></span>
        <h2 id="incident-map-title" className={styles.mapTitle}>Barangay San Isidro <span>•</span> Zone 723 DRRM Boundary</h2>
        <span className={styles.mapCount}>
          <span className={styles.liveDot} aria-hidden="true" />
          {validFeatures.length} mapped
        </span>
      </header>
      <div className={styles.mapCanvas} aria-busy={status === "loading"}>
        {status === "loading" ? (
          <div className={styles.mapLoading} role="status">
            <span className={styles.skeletonMap} aria-hidden="true" />
            <span className={styles.mapLoadingText}>Synchronizing Barangay Spatial Mesh...</span>
          </div>
        ) : status === "error" ? (
          <div className={styles.mapError} role="alert">
            <span className={styles.mapErrorIcon} aria-hidden="true"><MapErrorIcon /></span>
            <h3>{mapError}</h3>
            <p>The map is unavailable. The incident list and review queue remain available.</p>
            <div className={styles.mapErrorActions}>
              <button type="button" className={styles.primaryButton} onClick={retryMap}>Retry map</button>
              {currentResult?.status === "error" && (
                <span className={styles.mapErrorCode}>{currentResult.error}</span>
              )}
            </div>
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
              className={styles.mapSvg}
              role="group"
              aria-label={`Map of ${validFeatures.length} open incidents`}
            >
              <defs>
                <pattern id="incident-map-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" className={styles.mapGrid} fill="none" />
                </pattern>
              </defs>
              <rect width={WIDTH} height={HEIGHT} className={styles.mapBackground} />
              <rect width={WIDTH} height={HEIGHT} fill="url(#incident-map-grid)" />
              {validFeatures.map((feature) => {
                const [longitude, latitude] = feature.geometry.coordinates;
                const point = pointFor(longitude, latitude);
                const urgent = feature.properties.severity === "high" || feature.properties.severity === "critical";
                const selected = feature.id === selectedId;
                return (
                  <g
                    key={feature.id}
                    className={`${styles.mapMarker} ${selected ? styles.markerSelected : ""}`}
                    role="link"
                    tabIndex={0}
                    aria-label={`${feature.properties.severity ?? "Severity unconfirmed"}, ${feature.properties.incidentType ?? "Incident unconfirmed"}, ${feature.properties.trackingCode}, ${feature.properties.area ?? "Unknown area"}`}
                    onFocus={() => onSelect(feature.id)}
                    onMouseEnter={() => onSelect(feature.id)}
                    onClick={() => router.push(`/dashboard/incidents/${feature.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/dashboard/incidents/${feature.id}`);
                      }
                    }}
                  >
                    <title>{`${feature.properties.trackingCode} · ${feature.properties.band ?? "unscored"} · ${feature.properties.severity ?? "no severity"}${feature.properties.area ? ` · ${feature.properties.area}` : ""}`}</title>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={feature.properties.band === "P1" ? 10 : 8}
                      className={`${styles.markerCircle} ${urgent ? styles.markerUrgent : styles.markerOther}`}
                    />
                  </g>
                );
              })}
            </svg>
            <div className={styles.mapControls} role="group" aria-label="Map controls">
              <button type="button" onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))} aria-label="Zoom map in">+</button>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.8, value - 0.2))} aria-label="Zoom map out">−</button>
            </div>
            <MapLegend />
            {validFeatures.length === 0 && (
              <p className={styles.listMessage}>No open incidents to plot</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export function MapLegend() {
  return (
    <div className={styles.mapLegend} role="group" aria-label="Incident severity map legend">
      <strong className={styles.mapLegendTitle}>Map symbology</strong>
      <ul className={styles.legendItems}>
        <li><span className={`${styles.legendSwatch} ${styles.legendFilled}`} aria-hidden="true" />High / Critical</li>
        <li><span className={styles.legendSwatch} aria-hidden="true" />Other severity</li>
      </ul>
    </div>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="m2 4 5-2 6 2 5-2v14l-5 2-6-2-5 2V4Z" /><path d="M7 2v14m6-12v14" />
    </svg>
  );
}

function MapErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M5 5a8.5 8.5 0 1 1-1 10m1-10 5 1M5 5l-.5 5" /><path d="m9 9 6 6m0-6-6 6" />
    </svg>
  );
}
