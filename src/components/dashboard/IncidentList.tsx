"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import {
  DashboardErrorState,
  DashboardSkeleton,
  EmptyQueueState,
  NoResultsState,
} from "@/components/dashboard/DashboardStates";
import { IncidentMap } from "@/components/dashboard/IncidentMap";
import { IncidentRow, type DashboardIncident } from "@/components/dashboard/IncidentRow";
import { WorkflowStrip } from "@/components/dashboard/WorkflowStrip";
import { getDashboardState, type DashboardPreviewState } from "@/components/dashboard/dashboard-state";
import { useStaff } from "@/components/dashboard/StaffProvider";
import { WORKFLOW } from "@/lib/workflow";
import styles from "@/components/dashboard/Dashboard.module.css";

type LoadResult =
  | { key: string; status: "ready"; items: DashboardIncident[]; total: number }
  | { key: string; status: "error"; error: string };

const EMPTY_ITEMS: DashboardIncident[] = [];

export function IncidentList() {
  const staff = useStaff();
  const [status, setStatus] = useState("");
  const [band, setBand] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<DashboardPreviewState | null>(null);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const requested = new URLSearchParams(window.location.search).get("state");
    if (
      requested === "loading" ||
      requested === "ready" ||
      requested === "empty" ||
      requested === "map-error" ||
      requested === "no-results" ||
      requested === "error"
    ) {
      const timer = window.setTimeout(
        () => setPreviewState(requested as DashboardPreviewState),
        0,
      );
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleRefresh = () => setReload((value) => value + 1);
    window.addEventListener("sagip-dashboard-refresh", handleRefresh);
    return () => window.removeEventListener("sagip-dashboard-refresh", handleRefresh);
  }, []);

  const params = useMemo(() => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (band) query.set("band", band);
    if (type) query.set("type", type);
    return query;
  }, [status, band, type]);
  const requestKey = `${params.toString()}:${reload}`;

  useEffect(() => {
    let cancelled = false;
    void api<{ items: DashboardIncident[]; total: number }>(`/api/incidents?${params}`).then((response) => {
      if (cancelled) return;
      if (!response.ok) {
        setLoadResult({
          key: requestKey,
          status: "error",
          error: response.error ?? "Could not load incidents",
        });
        return;
      }
      setLoadResult({
        key: requestKey,
        status: "ready",
        items: response.data.items,
        total: response.data.total,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [params, requestKey]);

  const currentResult = loadResult?.key === requestKey ? loadResult : null;
  const loading = currentResult === null;
  const items = currentResult?.status === "ready" ? currentResult.items : EMPTY_ITEMS;
  const total = currentResult?.status === "ready" ? currentResult.total : 0;
  const error = currentResult?.status === "error" ? currentResult.error : null;
  const needle = search.trim().toLocaleLowerCase();
  const visibleItems = useMemo(
    () => items.filter((item) => {
      if (!needle) return true;
      return [
        item.trackingCode,
        item.location.area,
        item.description,
        item.incidentType?.replaceAll("_", " "),
        item.status.replaceAll("_", " "),
      ].some((value) => value?.toLocaleLowerCase().includes(needle));
    }),
    [items, needle],
  );
  const hasFilters = Boolean(status || band || type || needle);
  const dashboardState = getDashboardState({
    loading,
    error,
    preview: previewState,
    total,
    hasFilters,
    visibleCount: visibleItems.length,
  });
  const currentStep = WORKFLOW.find((step) => step.statuses.join(",") === status)?.label;

  function clearFilters() {
    setStatus("");
    setBand("");
    setType("");
    setSearch("");
    if (process.env.NODE_ENV === "development" && previewState === "no-results") {
      setPreviewState(null);
    }
  }

  function refresh() {
    setReload((value) => value + 1);
  }

  return (
    <div className={styles.pageStack}>
      <WorkflowStrip
        active={status}
        onSelect={setStatus}
        reload={reload}
        forceLoading={dashboardState === "loading"}
      />
      <DashboardFilters
        band={band}
        type={type}
        search={search}
        status={status}
        state={dashboardState}
        onBandChange={setBand}
        onTypeChange={setType}
        onSearchChange={setSearch}
        onClear={clearFilters}
      />
      <div aria-live="polite">
        {dashboardState === "loading" ? (
          <DashboardSkeleton />
        ) : dashboardState === "error" ? (
          <DashboardErrorState message={error ?? "Could not load incidents"} onRetry={refresh} />
        ) : dashboardState === "empty" ? (
          <EmptyQueueState />
        ) : dashboardState === "no-results" ? (
          <NoResultsState onClear={clearFilters} />
        ) : (
          <section className={styles.resultsGrid} aria-label="Ranked incidents and incident map">
            <section className={styles.incidentPanel} aria-labelledby="ranked-incidents-title">
              <header className={styles.panelHeading}>
                <h2 className={styles.panelTitle} id="ranked-incidents-title">Ranked Priority Triage</h2>
                <span className={styles.totalBadge}>{total} Total</span>
                <span className={styles.panelLive} aria-label="Incident feed active" />
              </header>
              {currentStep && <p className={styles.listMessage}>Showing workflow: {currentStep}</p>}
              <ul className={styles.incidentList} aria-busy={loading}>
                {visibleItems.map((incident) => (
                  <IncidentRow
                    key={incident.id}
                    incident={incident}
                    role={staff?.role ?? null}
                    selected={selectedId === incident.id}
                    onSelect={setSelectedId}
                  />
                ))}
                {visibleItems.length === 0 && (
                  <li className={styles.listMessage}>No incidents in this workflow step.</li>
                )}
              </ul>
            </section>
            <IncidentMap
              reload={reload}
              selectedId={selectedId}
              onSelect={setSelectedId}
              forceLoading={previewState === "loading"}
              forceError={previewState === "map-error"}
            />
          </section>
        )}
      </div>
    </div>
  );
}
