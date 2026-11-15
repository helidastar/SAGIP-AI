"use client";

import { INCIDENT_TYPES } from "@/lib/constants";
import styles from "@/components/dashboard/Dashboard.module.css";
import type { DashboardState } from "@/components/dashboard/dashboard-state";

export function DashboardFilters({
  band,
  type,
  search,
  status,
  state,
  onBandChange,
  onTypeChange,
  onSearchChange,
  onClear,
}: {
  band: string;
  type: string;
  search: string;
  status: string;
  state: DashboardState;
  onBandChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <section className={styles.filterPanel} aria-label="Incident filters">
      <div className={styles.filterMain}>
        <div className={styles.filterSearch}>
          <SearchIcon />
          <label htmlFor="dashboard-search" className={styles.srOnly}>
            Search tracking code, area, type, or incident description
          </label>
          <input
            id="dashboard-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onSearchChange("");
            }}
            placeholder="Search reference code, purok, or incident keyword"
          />
        </div>
        <label className={styles.selectGroup}>
          <span>Priority</span>
          <select value={band} onChange={(event) => onBandChange(event.target.value)} aria-label="Priority band">
            <option value="">All Bands</option>
            {["P1", "P2", "P3", "P4"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.selectGroup}>
          <span>Type</span>
          <select value={type} onChange={(event) => onTypeChange(event.target.value)} aria-label="Incident type">
            <option value="">All Types</option>
            {INCIDENT_TYPES.map((item) => (
              <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        {status && <span className={styles.filterActive}>Workflow: {status.replaceAll("_", " ")}</span>}
        {(band || type || search || status) && (
          <button type="button" className={styles.clearButton} onClick={onClear} disabled={state === "loading"}>
            <ResetIcon />
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" />
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
