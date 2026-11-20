"use client";

import Link from "next/link";
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api-client";
import { WORKFLOW } from "@/lib/workflow";
import { DashboardQueueCountContext } from "@/components/dashboard/DashboardShell";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import type { Severity } from "@/types";
import styles from "@/components/dashboard/RankedDashboard.module.css";

type DashboardIncident = {
  id: string;
  trackingCode: string;
  description: string;
  status: string;
  incidentType: string | null;
  severity: Severity | null;
  location: { lat: number; lng: number; area: string | null };
  priority: { score: number; band: string | null; overridden: boolean } | null;
  createdAt: string;
};

type MapFeature = {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: {
    trackingCode: string;
    severity: string | null;
    incidentType: string | null;
    band: string | null;
    area: string | null;
  };
};

type DashboardDetail = {
  id: string;
  trackingCode: string;
  description: string;
  status: string;
  incidentType: string | null;
  severity: Severity | null;
  location: { lat: number; lng: number; area: string | null };
  priority: { score: number; band: string | null } | null;
  createdAt: string;
  photoUrl: string | null;
  classifications: {
    model: string;
    incidentType: string;
    severity: Severity | null;
    confidence: number;
    createdAt: string;
  }[];
};

type ReadyData = {
  items: DashboardIncident[];
  total: number;
  workflowCounts: Record<string, number>;
  reviewCount: number | null;
  reviewIds: string[];
};

type LoadState =
  | { key: number; status: "loading" }
  | { key: number; status: "ready"; data: ReadyData }
  | { key: number; status: "error"; message: string };

type MapLoadState =
  | { key: string; status: "loading" }
  | { key: string; status: "ready"; features: MapFeature[] }
  | { key: string; status: "error"; message: string };

type PreviewState = "loading" | "ready" | "empty" | "no-results" | "map-error" | "error";

const PAGE_SIZE = 100;
const EMPTY_ITEMS: DashboardIncident[] = [];
const EMPTY_FEATURES: MapFeature[] = [];

export function RankedDashboard() {
  const setReviewCount = useContext(DashboardQueueCountContext);
  const [reload, setReload] = useState(0);
  const [mapRetry, setMapRetry] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ key: 0, status: "loading" });
  const [mapLoadState, setMapLoadState] = useState<MapLoadState>({ key: "0:0", status: "loading" });
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const requested = new URLSearchParams(window.location.search).get("state");
    if (
      requested === "loading" ||
      requested === "ready" ||
      requested === "empty" ||
      requested === "no-results" ||
      requested === "map-error" ||
      requested === "error"
    ) {
      const timer = window.setTimeout(() => setPreviewState(requested), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setReload((value) => value + 1);
    window.addEventListener("sagip-dashboard-refresh", refresh);
    return () => window.removeEventListener("sagip-dashboard-refresh", refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [incidentsResult, workflowResults, reviewResult] = await Promise.all([
        loadAllOpenIncidents(),
        Promise.all(
          WORKFLOW.map((step) =>
            api<{ total: number }>(
              `/api/incidents?status=${step.statuses.join(",")}&limit=1`,
            ),
          ),
        ),
        api<{ items: { id: string }[] }>("/api/review-queue"),
      ]);

      if (cancelled) return;
      if (!incidentsResult.ok) {
        setReviewCount(null);
        setReviewError(null);
        setLoadState({ key: reload, status: "error", message: incidentsResult.error });
        return;
      }

      const workflowCounts: Record<string, number> = {};
      for (let index = 0; index < WORKFLOW.length; index += 1) {
        const result = workflowResults[index];
        if (!result.ok) {
          setReviewCount(null);
          setReviewError(null);
          setLoadState({
            key: reload,
            status: "error",
            message: result.error ?? "Could not load workflow counts.",
          });
          return;
        }
        workflowCounts[WORKFLOW[index].key] = result.data.total;
      }

      const data: ReadyData = {
        ...incidentsResult,
        workflowCounts,
        reviewCount: reviewResult.ok ? reviewResult.data.items.length : null,
        reviewIds: reviewResult.ok ? reviewResult.data.items.map((item) => item.id) : [],
      };
      setLoadState({ key: reload, status: "ready", data });
      setReviewCount(data.reviewCount);
      setReviewError(reviewResult.ok ? null : reviewResult.error ?? "Could not load the review count.");
      setLastUpdated(new Date().toISOString());
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reload, setReviewCount]);

  useEffect(() => {
    let cancelled = false;
    const key = `${reload}:${mapRetry}`;

    void api<{ features: MapFeature[] }>("/api/incidents/map").then((response) => {
      if (cancelled) return;
      if (!response.ok) {
        setMapLoadState({
          key,
          status: "error",
          message: response.error ?? "Could not load map coordinates.",
        });
        return;
      }
      setMapLoadState({ key, status: "ready", features: response.data.features });
    });

    return () => {
      cancelled = true;
    };
  }, [mapRetry, reload]);

  const currentLoadState =
    loadState.key === reload ? loadState : { key: reload, status: "loading" as const };
  const mapRequestKey = `${reload}:${mapRetry}`;
  const currentMapLoadState =
    mapLoadState.key === mapRequestKey
      ? mapLoadState
      : { key: mapRequestKey, status: "loading" as const };
  const readyData = currentLoadState.status === "ready" ? currentLoadState.data : null;
  const items = readyData?.items ?? EMPTY_ITEMS;
  const mapFeatures = currentMapLoadState.status === "ready" ? currentMapLoadState.features : EMPTY_FEATURES;
  const selectedIncident = items[0] ?? null;
  const reviewIds = useMemo(() => new Set(readyData?.reviewIds ?? []), [readyData]);

  const previewError = previewState === "error";
  const reviewErrorWouldHideState =
    previewState === "loading" || previewState === "empty" || previewState === "no-results";
  const hasBlockingReviewError =
    Boolean(reviewError) &&
    currentLoadState.status === "ready" &&
    (items.length === 0 || reviewErrorWouldHideState);
  const viewState =
    currentLoadState.status === "error"
      ? "error"
      : previewError || hasBlockingReviewError
        ? "error"
        : currentLoadState.status === "loading" || previewState === "loading"
          ? "loading"
          : previewState === "empty"
            ? "empty"
            : previewState === "no-results"
              ? "no-results"
              : currentLoadState.status === "ready" && items.length === 0 && previewState !== "ready"
                ? "empty"
                : "ready";

  function retryDashboard() {
    setPreviewState(null);
    setReload((value) => value + 1);
  }

  function clearPreviewState() {
    setPreviewState(null);
  }

  function retryMap() {
    if (previewState === "map-error") setPreviewState(null);
    setMapRetry((value) => value + 1);
  }

  return (
    <div className={styles.page}>
      <DashboardTopBar
        lastUpdated={lastUpdated}
        onRefresh={() => window.dispatchEvent(new Event("sagip-dashboard-refresh"))}
      />

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Ranked incident list</h1>
          <p className={styles.pageSubtitle}>Open incidents sorted by priority.</p>
        </div>
      </div>

      <div className={styles.pageBody} aria-live="polite">
        {viewState === "loading" ? (
          <DashboardSkeleton />
        ) : viewState === "error" ? (
          <DashboardErrorState
            message={
              currentLoadState.status === "error"
                ? currentLoadState.message
                : [
                    previewError ? "Development preview state: forced incident load error." : null,
                    reviewError ? `Review count: ${reviewError}` : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Could not load dashboard data."
            }
            onRetry={retryDashboard}
          />
        ) : viewState === "empty" ? (
          <EmptyQueueState />
        ) : viewState === "no-results" ? (
          <NoResultsState onClear={clearPreviewState} />
        ) : readyData ? (
          <>
            {reviewError && (
              <DashboardErrorNotice message={reviewError} onRetry={retryDashboard} />
            )}
            <WorkflowCards
              counts={readyData.workflowCounts}
              activeStatus={null}
            />
            <FilterSurface
              items={items}
              total={readyData.total}
            />
            <div className={styles.resultsGrid}>
              <IncidentListPanel
                items={items}
                total={readyData.total}
                reviewIds={reviewIds}
                selectedId={selectedIncident?.id ?? null}
                now={now}
              />
              <IncidentMap
                features={mapFeatures}
                selectedId={selectedIncident?.id ?? null}
                loading={currentMapLoadState.status === "loading"}
                error={currentMapLoadState.status === "error" ? currentMapLoadState.message : null}
                forcedError={previewState === "map-error"}
                onRetry={retryMap}
                retryKey={mapRetry}
              />
            </div>
            {isDossierOpen && selectedIncident && (
              <IncidentDossier
                incident={selectedIncident}
                now={now}
                onClose={() => setIsDossierOpen(false)}
              />
            )}
            {!isDossierOpen && selectedIncident && (
              <button
                type="button"
                className={styles.openDossierButton}
                onClick={() => setIsDossierOpen(true)}
              >
                <DossierIcon />
                View Incident Dossier
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

async function loadAllOpenIncidents(): Promise<
  | { ok: true; items: DashboardIncident[]; total: number }
  | { ok: false; error: string }
> {
  const items: DashboardIncident[] = [];
  let total = 0;
  let offset = 0;

  do {
    const response = await api<{
      items: DashboardIncident[];
      total: number;
    }>(`/api/incidents?limit=${PAGE_SIZE}&offset=${offset}`);

    if (!response.ok) {
      return { ok: false, error: response.error ?? "Could not load incidents." };
    }

    total = response.data.total;
    items.push(...response.data.items);
    if (response.data.items.length === 0) {
      if (items.length < total) {
        return { ok: false, error: "Incident loading stopped before all records were received." };
      }
      break;
    }

    offset += response.data.items.length;
  } while (offset < total);

  return { ok: true, items, total };
}

function WorkflowCards({
  counts,
  activeStatus,
}: {
  counts: Record<string, number>;
  activeStatus: string | null;
}) {
  return (
    <section className={styles.workflowGrid} aria-label="Incident workflow">
      {WORKFLOW.map((step, index) => {
        const statuses = step.statuses.join(",");
        const selected = activeStatus === statuses;

        return (
          <article
            key={step.key}
            className={`${styles.workflowCard} ${selected ? styles.workflowCardSelected : ""}`}
          >
            <div className={styles.workflowTopline}>
              <span className={styles.overline}>Step {index + 1}</span>
              <span className={styles.workflowCount}>
                {counts[step.key] ?? "—"}
              </span>
            </div>
            <div className={styles.workflowCopy}>
              <h2>{step.label}</h2>
              {step.actor !== "—" && <p>by {step.actor}</p>}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function FilterSurface({
  items,
  total,
}: {
  items: DashboardIncident[];
  total: number;
}) {
  const bandCounts = countBy(items, (item) => item.priority?.band ?? "");
  const typeCounts = countBy(items, (item) => item.incidentType ?? "");
  const areaCounts = countBy(items, (item) => item.location.area ?? "");
  const types = Object.keys(typeCounts)
    .filter(Boolean)
    .sort((a, b) => formatType(a).localeCompare(formatType(b)));
  const areas = Object.keys(areaCounts).filter(Boolean).sort((a, b) => a.localeCompare(b));

  return (
    <section className={styles.filterPanel} aria-label="Incident filters">
      <div className={styles.filterMain}>
        <div className={styles.searchBox} aria-disabled="true">
          <SearchIcon />
          <input
            type="search"
            aria-label="Search tracking ID, area, or description"
            placeholder="Search tracking ID, area, or description"
            readOnly
          />
        </div>
        <div className={styles.sortControl}>
          <span className={styles.labelCaps}>Order by</span>
          <span className={styles.sortValue}>Priority score (highest first)</span>
        </div>
        <span className={styles.filterToggle} aria-disabled="true">
          <FilterIcon />
          <span>Filters</span>
        </span>
      </div>

      <div className={styles.filterRows}>
        <div className={styles.chipGroup}>
          <span className={styles.filterLabel}>Priority:</span>
          <span className={`${styles.filterChip} ${styles.filterChipActive}`}>All ({total})</span>
          {(["P1", "P2", "P3", "P4"] as const).map((band) => (
            <span className={styles.filterChip} key={band}>
              {band} {priorityLabel(band)} ({bandCounts[band] ?? 0})
            </span>
          ))}
        </div>
        {types.length > 0 && (
          <div className={styles.chipGroup}>
            <span className={styles.filterLabel}>Type:</span>
            {types.map((type) => (
              <span className={styles.filterChip} key={type}>
                {formatType(type)} ({typeCounts[type]})
              </span>
            ))}
          </div>
        )}
        {areas.length > 0 && (
          <div className={styles.chipGroup}>
            <span className={styles.filterLabel}>Zone:</span>
            {areas.map((area) => (
              <span className={styles.filterChip} key={area}>
                {area} ({areaCounts[area]})
              </span>
            ))}
          </div>
        )}
        <span className={styles.resetAll}>
          <ResetIcon />
          Reset All
        </span>
      </div>
    </section>
  );
}

function IncidentListPanel({
  items,
  total,
  reviewIds,
  selectedId,
  now,
}: {
  items: DashboardIncident[];
  total: number;
  reviewIds: Set<string>;
  selectedId: string | null;
  now: number | null;
}) {
  return (
    <section className={styles.listPanel} aria-labelledby="ranked-incidents-title">
      <header className={styles.panelHeading}>
        <h2 id="ranked-incidents-title">Ranked Priority Triage</h2>
        <span className={styles.totalBadge}>{total} Total</span>
      </header>
      <ol
        className={styles.incidentList}
        aria-label="Open incidents ranked by priority"
        tabIndex={0}
      >
        {items.map((incident) => (
          <IncidentRow
            key={incident.id}
            incident={incident}
            needsReview={reviewIds.has(incident.id) || incident.status === "pending_review"}
            selected={incident.id === selectedId}
            now={now}
          />
        ))}
      </ol>
      <footer className={styles.listFooter}>
        Displaying {items.length} of {total} incidents
      </footer>
    </section>
  );
}

function IncidentRow({
  incident,
  needsReview,
  selected,
  now,
}: {
  incident: DashboardIncident;
  needsReview: boolean;
  selected: boolean;
  now: number | null;
}) {
  return (
    <li className={`${styles.incidentRow} ${selected ? styles.incidentRowSelected : ""}`}>
      <Link
        href={`/dashboard/incidents/${incident.id}`}
        className={styles.incidentLink}
        aria-label={`Open ${incident.trackingCode}, ${formatType(incident.incidentType ?? "unconfirmed")}`}
      >
        <PriorityBadge band={incident.priority?.band ?? null} />
        <span className={styles.incidentCopy}>
          <span className={styles.incidentTopline}>
            <span className={styles.trackingCode}>{incident.trackingCode}</span>
            {needsReview && <span className={styles.reviewTag}>Review</span>}
          </span>
          <span className={styles.incidentType}>
            {formatType(incident.incidentType ?? "unconfirmed")}
          </span>
          {incident.description && (
            <span className={styles.incidentDescription}>{incident.description}</span>
          )}
          <span className={styles.incidentMeta}>
            <LocationIcon />
            <span>{incident.location.area ?? "Area not provided"}</span>
          </span>
        </span>
        <span className={styles.incidentTrailing}>
          {incident.priority && Number.isFinite(incident.priority.score) && (
            <span className={styles.score}>
              {formatScore(incident.priority.score)}
            </span>
          )}
          <span className={styles.elapsed}>
            {now === null ? "—" : elapsedSince(incident.createdAt, now)}
          </span>
          <SeverityTag severity={incident.severity} />
          <StatusTag status={incident.status} />
        </span>
      </Link>
    </li>
  );
}

function IncidentMap({
  features,
  selectedId,
  loading,
  error,
  forcedError,
  onRetry,
  retryKey,
}: {
  features: MapFeature[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  forcedError: boolean;
  onRetry: () => void;
  retryKey: number;
}) {
  const validFeatures = useMemo(
    () =>
      features.filter((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        return Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180;
      }),
    [features],
  );
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  return (
    <section className={styles.mapPanel} aria-labelledby="incident-map-title">
      <header className={styles.mapHeading}>
        <MapIcon />
        <h2 id="incident-map-title">Incident locations</h2>
      </header>
      <div className={styles.mapCanvas} aria-busy={loading}>
        {error || forcedError || runtimeError ? (
          <div className={styles.mapError} role="alert">
            <MapErrorIcon />
            <h3>Map unavailable</h3>
            <p>{forcedError ? "Development preview state: forced map error." : error ?? runtimeError}</p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setRuntimeError(null);
                onRetry();
              }}
            >
              Retry map
            </button>
          </div>
        ) : loading ? (
          <div className={styles.mapLoading} role="status" aria-label="Loading incident map">
            <span className={styles.skeletonMap} aria-hidden="true" />
          </div>
        ) : validFeatures.length === 0 ? (
          <div className={styles.mapEmpty} role="status">
            No valid incident coordinates are available.
          </div>
        ) : (
          <>
            <LeafletMap
              key={retryKey}
              features={validFeatures}
              selectedId={selectedId}
              onError={setRuntimeError}
            />
            <div className={styles.mapControls} role="group" aria-label="Map controls">
              <button type="button" onClick={() => window.dispatchEvent(new Event("sagip-map-zoom-in"))} aria-label="Zoom map in">
                <PlusIcon />
              </button>
              <button type="button" onClick={() => window.dispatchEvent(new Event("sagip-map-zoom-out"))} aria-label="Zoom map out">
                <MinusIcon />
              </button>
              <button type="button" onClick={() => window.dispatchEvent(new Event("sagip-map-fit"))} aria-label="Recenter map to all markers">
                <RecenterIcon />
              </button>
            </div>
            <MapLegend />
          </>
        )}
      </div>
    </section>
  );
}

function LeafletMap({
  features,
  selectedId,
  onError,
}: {
  features: MapFeature[];
  selectedId: string | null;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitMarkersRef = useRef<() => void>(() => {});
  const zoomInRef = useRef<() => void>(() => {});
  const zoomOutRef = useRef<() => void>(() => {});
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;

    async function initialize() {
      try {
        const leaflet = await import("leaflet");
        if (disposed || !containerRef.current) return;

        const mapInstance = leaflet.map(containerRef.current, {
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        });
        map = mapInstance;
        // Street map behind the priority pins. OpenStreetMap credit is shown by the attribution control.
        leaflet
          .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          })
          .addTo(mapInstance);

        const markers = features.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const band = feature.properties.band;
          const markerContent = document.createElement("span");
          markerContent.className = `${styles.markerContent} ${priorityMarkerClass(band)}`;

          const symbol = document.createElement("span");
          symbol.className = styles.markerSymbol;
          symbol.setAttribute("aria-hidden", "true");
          symbol.textContent = prioritySymbol(band);

          const label = document.createElement("span");
          label.className = styles.markerBand;
          label.textContent = band ?? "–";
          markerContent.append(symbol, label);

          const marker = leaflet.marker([lat, lng], {
            keyboard: false,
            icon: leaflet.divIcon({
              className: styles.leafletMarker,
              html: markerContent,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            }),
          });
          marker.addTo(mapInstance);

          if (feature.id === selectedId) {
            const selectedLabel = document.createElement("span");
            selectedLabel.textContent = `${feature.properties.trackingCode} · ${band ?? "–"}`;
            marker.bindTooltip(selectedLabel, {
              permanent: true,
              direction: "top",
              offset: [0, -12],
              className: styles.selectedTooltip,
            });
          }
          return marker;
        });

        const fitMarkers = () => {
          if (!map || markers.length === 0) return;
          if (markers.length === 1) {
            map.setView(markers[0].getLatLng(), 14, { animate: false });
            return;
          }
          const bounds = leaflet.latLngBounds(markers.map((marker) => marker.getLatLng()));
          if (bounds.isValid()) map.fitBounds(bounds.pad(0.15), { maxZoom: 16, animate: false });
        };

        fitMarkersRef.current = fitMarkers;
        zoomInRef.current = () => map?.zoomIn();
        zoomOutRef.current = () => map?.zoomOut();
        fitMarkers();
      } catch {
        if (!disposed) onErrorRef.current("The map could not be initialized.");
      }
    }

    void initialize();

    const zoomIn = () => zoomInRef.current();
    const zoomOut = () => zoomOutRef.current();
    const fitMarkers = () => fitMarkersRef.current();
    window.addEventListener("sagip-map-zoom-in", zoomIn);
    window.addEventListener("sagip-map-zoom-out", zoomOut);
    window.addEventListener("sagip-map-fit", fitMarkers);

    return () => {
      disposed = true;
      window.removeEventListener("sagip-map-zoom-in", zoomIn);
      window.removeEventListener("sagip-map-zoom-out", zoomOut);
      window.removeEventListener("sagip-map-fit", fitMarkers);
      map?.remove();
      fitMarkersRef.current = () => {};
      zoomInRef.current = () => {};
      zoomOutRef.current = () => {};
    };
  }, [features, selectedId]);

  return <div ref={containerRef} className={styles.leafletMap} aria-label="Map showing open incident coordinates" role="img" />;
}

function MapLegend() {
  return (
    <div className={styles.mapLegend} role="group" aria-label="Priority map legend">
      <strong>Priority</strong>
      {(["P1", "P2", "P3", "P4"] as const).map((band) => (
        <span className={styles.legendItem} key={band}>
          <span className={`${styles.legendMarker} ${priorityMarkerClass(band)}`} aria-hidden="true">
            <span>{prioritySymbol(band)}</span>
          </span>
          {band}
        </span>
      ))}
    </div>
  );
}

function IncidentDossier({
  incident,
  now,
  onClose,
}: {
  incident: DashboardIncident;
  now: number | null;
  onClose: () => void;
}) {
  const [detailState, setDetailState] = useState<
    | { key: string; status: "loading" }
    | { key: string; status: "ready"; detail: DashboardDetail }
    | { key: string; status: "error"; message: string }
  >({ key: "", status: "loading" });
  const [retry, setRetry] = useState(0);
  const detailRequestKey = `${incident.id}:${retry}`;

  useEffect(() => {
    let cancelled = false;

    void api<DashboardDetail>(`/api/incidents/${incident.id}`).then((response) => {
      if (cancelled) return;
      if (!response.ok) {
        setDetailState({
          key: detailRequestKey,
          status: "error",
          message: response.error ?? "Could not load incident details.",
        });
        return;
      }
      if (response.data.id !== incident.id) {
        setDetailState({
          key: detailRequestKey,
          status: "error",
          message: "Incident details did not match the selected record.",
        });
        return;
      }
      setDetailState({ key: detailRequestKey, status: "ready", detail: response.data });
    });

    return () => {
      cancelled = true;
    };
  }, [detailRequestKey, incident.id]);

  const currentDetailState =
    detailState.key === detailRequestKey ? detailState : { key: detailRequestKey, status: "loading" as const };
  const detail = currentDetailState.status === "ready" ? currentDetailState.detail : null;
  const latestClassification = detail?.classifications[0] ?? null;
  const isDemoData = detail ? isExistingDemoRecord(detail) : false;

  return (
    <section className={styles.dossier} aria-labelledby="incident-dossier-title">
      <header className={styles.dossierHeading}>
        <div className={styles.dossierTitleWrap}>
          <DossierIcon />
          <h2 id="incident-dossier-title">Incident Dossier</h2>
          {isDemoData && <span className={styles.demoBadge}>Demo data</span>}
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close incident dossier">
          <CloseIcon />
        </button>
      </header>

      {currentDetailState.status === "loading" ? (
        <div className={styles.dossierSkeleton} aria-busy="true" aria-label="Loading incident dossier">
          <span />
          <span />
        </div>
      ) : currentDetailState.status === "error" ? (
        <div className={styles.detailError} role="alert">
          <p>{currentDetailState.message}</p>
          <button type="button" className={styles.secondaryButton} onClick={() => setRetry((value) => value + 1)}>
            Retry
          </button>
        </div>
      ) : detail ? (
        <>
          <div className={styles.dossierIdentity}>
            <PriorityBadge band={detail.priority?.band ?? null} />
            <div className={styles.dossierIdentityCopy}>
              <span className={styles.trackingCode}>{detail.trackingCode}</span>
              <h3>{formatType(detail.incidentType ?? "unconfirmed")}</h3>
            </div>
            <div className={styles.reportedAt}>
              <span>Reported: {formatDate(detail.createdAt)}</span>
              <strong>{now === null ? "—" : elapsedSince(detail.createdAt, now)}</strong>
            </div>
          </div>

          <dl className={styles.summaryGrid}>
            <SummaryTile label="Priority score" value={detail.priority ? `${formatScore(detail.priority.score)} / 100` : "—"} />
            <SummaryTile label="Severity" value={severityLabel(detail.severity)} />
            <SummaryTile label="Status" value={statusLabel(detail.status)} />
            <SummaryTile
              label="Location"
              value={`${formatCoordinate(detail.location.lat)}, ${formatCoordinate(detail.location.lng)}`}
              mono
            />
          </dl>

          <section className={styles.aiSummary} aria-labelledby="ai-summary-title">
            <div className={styles.aiSummaryHeading}>
              <AiIcon />
              <h3 id="ai-summary-title">AI summary</h3>
            </div>
            {latestClassification ? (
              <dl className={styles.aiSummaryGrid}>
                <DataPair label="Model / step" value={latestClassification.model} />
                <DataPair label="Predicted type" value={formatType(latestClassification.incidentType)} />
                <DataPair label="Severity" value={severityLabel(latestClassification.severity)} />
                <DataPair label="Confidence" value={formatPercent(latestClassification.confidence)} />
              </dl>
            ) : (
              <p className={styles.noAiResult}>No AI result yet</p>
            )}
          </section>

          {detail.photoUrl && (
            <div className={styles.evidencePhoto}>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed evidence URL comes from the existing staff API */}
              <img
                src={detail.photoUrl}
                alt={`Evidence for ${detail.trackingCode}`}
              />
            </div>
          )}

          <div className={styles.dossierActions}>
            <Link href={`/dashboard/incidents/${detail.id}`} className={styles.secondaryButton}>
              Open Full Details
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
}

function SummaryTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className={styles.summaryTile}>
      <dt>{label}</dt>
      <dd className={mono ? styles.monoValue : ""}>{value}</dd>
    </div>
  );
}

function DataPair({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.dataPair}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PriorityBadge({ band }: { band: string | null }) {
  return (
    <span className={`${styles.priorityBadge} ${priorityBadgeClass(band)}`} aria-label={band ? `Priority ${band}` : "Priority unconfirmed"}>
      <PriorityIcon band={band} />
      {band ?? "–"}
    </span>
  );
}

function SeverityTag({ severity }: { severity: Severity | null }) {
  return (
    <span className={`${styles.severityTag} ${severityClass(severity)}`}>
      <SeverityIcon severity={severity} />
      {severityLabel(severity)}
    </span>
  );
}

function StatusTag({ status }: { status: string }) {
  return (
    <span className={`${styles.statusTag} ${statusClass(status)}`}>
      <StatusIcon status={status} />
      {statusLabel(status)}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className={styles.loadingStack} aria-label="Loading dashboard data" aria-busy="true">
      <div className={styles.workflowGrid} aria-hidden="true">
        {WORKFLOW.map((step) => <div className={styles.skeletonWorkflow} key={step.key} />)}
      </div>
      <div className={styles.filterSkeleton} aria-hidden="true" />
      <div className={styles.resultsGrid} aria-hidden="true">
        <div className={styles.panelSkeleton} />
        <div className={styles.panelSkeleton} />
      </div>
    </div>
  );
}

function EmptyQueueState() {
  return (
    <section className={styles.stateCard} aria-labelledby="empty-queue-title">
      <span className={styles.stateIcon} aria-hidden="true"><CheckIcon /></span>
      <h2 id="empty-queue-title">No open incidents</h2>
      <p>There are no incident records in the open response queue.</p>
    </section>
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <section className={styles.stateCard} aria-labelledby="no-results-title">
      <span className={`${styles.stateIcon} ${styles.stateIconNeutral}`} aria-hidden="true">
        <FilterIcon />
      </span>
      <h2 id="no-results-title">No incidents match the current filters</h2>
      <p>Clear the filters to see matching incidents.</p>
      <button type="button" className={styles.primaryButton} onClick={onClear}>
        Clear filters
      </button>
    </section>
  );
}

function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className={styles.errorState} role="alert" aria-labelledby="dashboard-error-title">
      <ErrorIcon />
      <div>
        <h2 id="dashboard-error-title">Unable to load dashboard data</h2>
        <p>{message}</p>
        <button type="button" className={styles.primaryButton} onClick={onRetry}>Retry</button>
      </div>
    </section>
  );
}

function DashboardErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className={styles.errorNotice} role="alert">
      <ErrorIcon />
      <p>Review count unavailable: {message}</p>
      <button type="button" className={styles.secondaryButton} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function MapErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M5 5a8.5 8.5 0 1 1-1 10m1-10 5 1M5 5l-.5 5" /><path d="m9 9 6 6m0-6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m12 3 2.2 1.4 2.6.1 1.1 2.3 2.1 1.5-.5 2.6.7 2.5-1.8 1.9-.6 2.5-2.5.7-2 1.7-2.3-1.1-2.6.1-1.4-2.2-2.3-1.1-.1-2.6-1.4-2.2 1.4-2.2.1-2.6 2.3-1.1 1.4-2.2 2.6.1L12 3Z" />
      <path d="m8.6 12.1 2.2 2.2 4.7-4.8" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3 22 21H2L12 3Z" />
      <path d="M12 9v5m0 3v.1" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 5h16M7 10h10m-7 5h4m-2 0v5" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4.5 7.5A8 8 0 1 1 4 14m.5-6.5V3m0 4.5H9" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="m2 4 5-2 6 2 5-2v14l-5 2-6-2-5 2V4Z" /><path d="M7 2v14m6-12v14" />
    </svg>
  );
}

function DossierIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M6 4h12v17H6zM9 2h6v4H9zM9 10h6m-6 4h6m-6 4h4" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" />
      <circle cx="12" cy="12" r="5" /><path d="M10 12h4m-2-2v4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 5v14m-7-7h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

function RecenterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
  );
}

function PriorityIcon({ band }: { band: string | null }) {
  return (
    <span className={styles.prioritySymbol} aria-hidden="true">
      {prioritySymbol(band)}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: Severity | null }) {
  if (severity === "critical") {
    return <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 1 11 10H1L6 1Z" /></svg>;
  }
  if (severity === "high") {
    return <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 1.2 10.8 6 6 10.8 1.2 6 6 1.2Z" /></svg>;
  }
  if (severity === "moderate") {
    return <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><circle cx="6" cy="6" r="4.3" /></svg>;
  }
  if (severity === "low") {
    return <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2 3h8v6H2z" /></svg>;
  }
  return <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="6" cy="6" r="4.3" /></svg>;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "pending_review") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M8 2.2 14 13H2L8 2.2Z" /><path d="M8 6v3m0 1.7v.1" />
      </svg>
    );
  }
  if (status === "resolved") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="8" cy="8" r="6" /><path d="m5 8 2 2 4-4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M2 8.5 6 12l8-8" />
    </svg>
  );
}

function countBy<T>(items: T[], keyFor: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function formatType(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function priorityLabel(band: "P1" | "P2" | "P3" | "P4") {
  return {
    P1: "Immediate",
    P2: "Urgent",
    P3: "Standard",
    P4: "Low",
  }[band];
}

function prioritySymbol(band: string | null) {
  return band === "P1" ? "▲" : band === "P2" ? "!" : band === "P3" ? "i" : band === "P4" ? "−" : "?";
}

function priorityBadgeClass(band: string | null) {
  return band === "P1"
    ? styles.priorityP1
    : band === "P2"
      ? styles.priorityP2
      : band === "P3"
        ? styles.priorityP3
        : band === "P4"
          ? styles.priorityP4
          : styles.priorityNone;
}

function priorityMarkerClass(band: string | null) {
  return band === "P1"
    ? styles.markerP1
    : band === "P2"
      ? styles.markerP2
      : band === "P3"
        ? styles.markerP3
        : band === "P4"
          ? styles.markerP4
          : styles.markerUnconfirmed;
}

function severityClass(severity: Severity | null) {
  return severity === "critical"
    ? styles.severityCritical
    : severity === "high"
      ? styles.severityHigh
      : severity === "moderate"
        ? styles.severityModerate
        : severity === "low"
          ? styles.severityLow
          : styles.severityUnconfirmed;
}

function severityLabel(severity: Severity | null) {
  return severity ? `${severity[0].toLocaleUpperCase()}${severity.slice(1)}` : "Unconfirmed";
}

function statusClass(status: string) {
  return status === "pending_review"
    ? styles.statusReview
    : status === "classified"
      ? styles.statusAssign
      : status === "resolved"
        ? styles.statusResolved
        : status === "rejected"
          ? styles.statusRejected
          : styles.statusProgress;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function formatScore(score: number) {
  return Number.isInteger(score) ? `${score}.0` : score.toFixed(1);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : "—";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function elapsedSince(value: string, now: number) {
  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (elapsedSeconds < 60) return `+${elapsedSeconds}s ago`;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `+${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `+${hours}h ${remainingMinutes}m ago`;
  return `+${Math.floor(hours / 24)}d ago`;
}

function isExistingDemoRecord(detail: DashboardDetail) {
  const placeholderAreas = ["Sample Area A", "Sample Area B", "Sample Area C"];
  return detail.trackingCode.startsWith("SGP-DEM") ||
    (detail.location.area !== null && placeholderAreas.includes(detail.location.area));
}
