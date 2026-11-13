"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { FilterBar, type IncidentSort } from "@/components/dashboard/DashboardFilters";
import {
  DashboardSkeleton,
  EmptyQueueState,
  NoResultsState,
} from "@/components/dashboard/DashboardStates";
import { IncidentMap } from "@/components/dashboard/IncidentMap";
import { IncidentRow, type DashboardIncident } from "@/components/dashboard/IncidentRow";
import { WorkflowStrip } from "@/components/dashboard/WorkflowStrip";
import {
  getIncidentDashboardStatus,
  type DashboardPreviewState,
} from "@/lib/dashboard-state";
import { WORKFLOW } from "@/lib/workflow";

type IncidentLoadResult =
  | { key: string; state: "ready"; items: DashboardIncident[]; total: number }
  | { key: string; state: "error"; error: string };

const EMPTY_INCIDENTS: DashboardIncident[] = [];

/** Priority-ranked incident list, filters, workflow counts, and map. */
export function IncidentList() {
  const [status, setStatus] = useState("");
  const [band, setBand] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<IncidentSort>("priority");
  const [reload, setReload] = useState(0);
  const [previewState, setPreviewState] = useState<DashboardPreviewState | null>(null);
  const [loadResult, setLoadResult] = useState<IncidentLoadResult | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const requested = new URLSearchParams(window.location.search).get("state");
    if (
      requested === "loading" ||
      requested === "empty" ||
      requested === "map-error" ||
      requested === "no-results"
    ) {
      const timer = window.setTimeout(() => setPreviewState(requested), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const requestParams = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (band) params.set("band", band);
    if (type) params.set("type", type);
    return params;
  }, [status, band, type]);
  const requestKey = JSON.stringify([requestParams.toString(), reload]);

  useEffect(() => {
    let cancelled = false;
    void api<{ items: DashboardIncident[]; total: number }>(`/api/incidents?${requestParams}`).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLoadResult({
          key: requestKey,
          state: "error",
          error: res.error ?? "Could not load incidents",
        });
        return;
      }
      setLoadResult({
        key: requestKey,
        state: "ready",
        items: res.data.items,
        total: res.data.total,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [requestParams, requestKey]);

  const currentResult = loadResult?.key === requestKey ? loadResult : null;
  const loading = currentResult === null;
  const items = currentResult?.state === "ready" ? currentResult.items : EMPTY_INCIDENTS;
  const total = currentResult?.state === "ready" ? currentResult.total : 0;
  const error = currentResult?.state === "error" ? currentResult.error : null;
  const filteredStep = WORKFLOW.find((step) => step.statuses.join(",") === status)?.label;
  const hasFilters = Boolean(status || band || type || search.trim());
  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const matched = items.filter((item) => {
      if (!needle) return true;
      return [
        item.trackingCode,
        item.location.area,
        item.description,
        item.incidentType?.replaceAll("_", " "),
        item.status.replaceAll("_", " "),
      ].some((value) => value?.toLocaleLowerCase().includes(needle));
    });
    if (sort === "priority") return matched;
    return [...matched].sort((a, b) => {
      const difference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "newest" ? -difference : difference;
    });
  }, [items, search, sort]);

  const dashboardStatus = getIncidentDashboardStatus({
    loading,
    error,
    preview: previewState,
    total,
    hasFilters,
    visibleCount: visibleItems.length,
  });

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
    <div className="dashboard-page">
      <WorkflowStrip
        active={status}
        onSelect={setStatus}
        reload={reload}
        loading={dashboardStatus === "loading"}
      />
      <FilterBar
        band={band}
        type={type}
        search={search}
        sort={sort}
        hasWorkflow={Boolean(status)}
        status={status}
        dashboardStatus={dashboardStatus}
        onBandChange={setBand}
        onTypeChange={setType}
        onSearchChange={setSearch}
        onSortChange={setSort}
        onClear={clearFilters}
        onRefresh={refresh}
      />
      <div id="ranked-list" className="dashboard-results" aria-live="polite">
        {dashboardStatus === "loading" ? (
          <DashboardSkeleton />
        ) : dashboardStatus === "error" ? (
          <section className="dashboard-request-error" role="alert">
            <h2>Unable to load incidents</h2>
            <p>{error}</p>
            <button type="button" className="dashboard-primary-button" onClick={refresh}>
              Retry
            </button>
          </section>
        ) : dashboardStatus === "empty" ? (
          <EmptyQueueState />
        ) : dashboardStatus === "no-results" ? (
          <NoResultsState onClear={clearFilters} />
        ) : (
          <div className="dashboard-results-grid">
            <section className="dashboard-incident-panel" aria-labelledby="incident-list-title">
              <header className="dashboard-panel-heading">
                <h2 id="incident-list-title">Ranked Priority Triage</h2>
                <span className="dashboard-total-pill">{total} Total</span>
                <span className="dashboard-panel-live" aria-label="Incident feed active" />
              </header>
              <ul className="dashboard-incident-list" aria-busy={loading}>
                {visibleItems.map((incident, index) => (
                  <IncidentRow key={incident.id} incident={incident} index={index} />
                ))}
                {visibleItems.length === 0 && (
                  <li className="dashboard-list-empty">
                    No incidents in this workflow step.
                  </li>
                )}
              </ul>
              {filteredStep && (
                <p className="dashboard-filter-note">
                  Showing workflow step: <strong>{filteredStep}</strong>
                </p>
              )}
            </section>
            <IncidentMap
              reload={reload}
              forceError={previewState === "map-error"}
              forceLoading={previewState === "loading"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
