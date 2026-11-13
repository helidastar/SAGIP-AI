"use client";

import type { IncidentType } from "@/types";
import { INCIDENT_TYPES } from "@/lib/constants";
import type { IncidentDashboardStatus } from "@/lib/dashboard-state";

export type IncidentSort = "priority" | "newest" | "oldest";

export function FilterBar({
  band,
  type,
  search,
  sort,
  hasWorkflow,
  status,
  dashboardStatus,
  onBandChange,
  onTypeChange,
  onSearchChange,
  onSortChange,
  onClear,
  onRefresh,
}: {
  band: string;
  type: string;
  search: string;
  sort: IncidentSort;
  hasWorkflow: boolean;
  status: string;
  dashboardStatus: IncidentDashboardStatus;
  onBandChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: IncidentSort) => void;
  onClear: () => void;
  onRefresh: () => void;
}) {
  const isBusy = dashboardStatus === "loading";

  return (
    <section className="dashboard-filter-panel" aria-label="Incident filters">
      <div className="dashboard-filter-main">
        <div className="dashboard-search">
          <SearchIcon />
          <label htmlFor="dashboard-incident-search" className="sr-only">Search incidents</label>
          <input
            id="dashboard-incident-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onSearchChange("");
            }}
            placeholder="Search reference code, purok, or incident keyword"
            aria-label="Search reference code, area, or incident description"
          />
          {search && (
            <button type="button" className="dashboard-search-clear" onClick={() => onSearchChange("")} aria-label="Clear search">
              Esc to clear
            </button>
          )}
        </div>
        <label className="dashboard-sort">
          <span>Order by</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as IncidentSort)}
            aria-label="Order incidents by"
          >
            <option value="priority">Sort by Priority Score (Desc)</option>
            <option value="newest">Sort by Most Recent</option>
            <option value="oldest">Sort by Oldest</option>
          </select>
        </label>
        <button type="button" className="dashboard-refresh-button" onClick={onRefresh} disabled={isBusy}>
          <RefreshIcon />
          <span>Refresh</span>
        </button>
      </div>
      <div className="dashboard-filter-row">
        <label className="dashboard-filter-select">
          <span>Priority</span>
          <select value={band} onChange={(event) => onBandChange(event.target.value)} aria-label="Priority band">
            <option value="">All Bands</option>
            {["P1", "P2", "P3", "P4"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="dashboard-filter-select">
          <span>Type</span>
          <select value={type} onChange={(event) => onTypeChange(event.target.value)} aria-label="Incident type">
            <option value="">All Types</option>
            {INCIDENT_TYPES.map((item: IncidentType) => (
              <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        {hasWorkflow && (
          <span className="dashboard-filter-active">
            Workflow: {status.replaceAll("_", " ")}
          </span>
        )}
        <button type="button" className="dashboard-clear-filters" onClick={onClear} disabled={isBusy}>
          <ResetIcon />
          <span>Reset all</span>
        </button>
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.5-4L4 9m0-4v4h4m-4 4a8 8 0 0 0 14.5 4L20 15m0 4v-4h-4" />
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
