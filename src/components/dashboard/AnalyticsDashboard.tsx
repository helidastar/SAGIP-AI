"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { DashboardQueueCountContext } from "@/components/dashboard/DashboardShell";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import styles from "@/components/dashboard/AnalyticsDashboard.module.css";

type Period = "today" | "7days" | "30days";

type Incident = {
  id: string;
  trackingCode: string;
  status: string;
  incidentType: string | null;
  priority: { band: string | null } | null;
  createdAt: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; items: Incident[]; updatedAt: string }
  | { status: "error"; message: string };

const PAGE_SIZE = 100;
const REPORT_STATUSES = [
  "received",
  "pending_review",
  "classified",
  "assigned",
  "in_progress",
  "resolved",
  "rejected",
];
const INCIDENT_TYPES = [
  ["flood", "Flood"],
  ["fallen_debris", "Fallen Debris"],
  ["road_accident", "Road Accident"],
  ["structural_damage", "Structural Damage"],
  ["fire", "Fire"],
  ["medical_emergency", "Medical Emergency"],
  ["landslide", "Landslide"],
  ["other", "Other Categories"],
] as const;
const PRIORITIES = [
  { band: "P1", label: "Immediate", color: "red" },
  { band: "P2", label: "Urgent", color: "amber" },
  { band: "P3", label: "Standard", color: "blue" },
  { band: "P4", label: "Low", color: "slate" },
] as const;
const LIFECYCLE = [
  { status: "received", label: "New", color: "pale" },
  { status: "pending_review", label: "Review", color: "red" },
  { status: "classified", label: "Confirmed", color: "blue" },
  { status: "assigned", label: "Assigned", color: "teal" },
  { status: "in_progress", label: "Responding", color: "darkTeal" },
  { status: "resolved", label: "Resolved", color: "green" },
  { status: "rejected", label: "Rejected", color: "pale" },
] as const;
const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  "7days": "7 days",
  "30days": "30 days",
};

export function AnalyticsDashboard() {
  const setReviewCount = useContext(DashboardQueueCountContext);
  const [period, setPeriod] = useState<Period>("7days");
  const [reload, setReload] = useState(0);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [typeTable, setTypeTable] = useState(false);
  const [flowTable, setFlowTable] = useState(false);
  const [timelineTable, setTimelineTable] = useState(false);

  const refresh = useCallback(() => {
    setLoadState({ status: "loading" });
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - 29);
      const [incidentsResult, reviewResult] = await Promise.all([
        loadIncidents(since.toISOString()),
        // Same source as the Review Queue page, so the sidebar badge matches everywhere.
        api<{ items: unknown[] }>("/api/review-queue"),
      ]);
      if (cancelled) return;

      if (!incidentsResult.ok) {
        setLoadState({ status: "error", message: incidentsResult.error });
        setReviewCount(null);
        return;
      }

      setLoadState({
        status: "ready",
        items: incidentsResult.items,
        updatedAt: new Date().toISOString(),
      });
      if (reviewResult.ok) {
        const count = reviewResult.data.items.length;
        setReviewError(null);
        setReviewCount(count);
      } else {
        setReviewError(reviewResult.error ?? "Could not load the review queue count.");
        setReviewCount(null);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reload, setReviewCount]);

  const items = useMemo(() => {
    if (loadState.status !== "ready") return [];
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (period === "today" ? 0 : period === "7days" ? 6 : 29));
    return loadState.items.filter((item) => new Date(item.createdAt) >= start);
  }, [loadState, period]);

  const metrics = useMemo(() => {
    const statusCounts = Object.fromEntries(
      REPORT_STATUSES.map((status) => [status, items.filter((item) => item.status === status).length]),
    ) as Record<string, number>;
    const typeCounts: { type: string; label: string; count: number }[] = INCIDENT_TYPES.map(([type, label]) => ({
      type,
      label,
      count: items.filter((item) => item.incidentType === type).length,
    }));
    const unclassified = items.filter((item) => !item.incidentType).length;
    if (unclassified) typeCounts.push({ type: "unclassified", label: "Unclassified", count: unclassified });

    const priorityCounts = PRIORITIES.map((priority) => ({
      ...priority,
      count: items.filter((item) => item.priority?.band === priority.band).length,
    }));
    const scored = priorityCounts.reduce((sum, item) => sum + item.count, 0);
    const days = period === "today" ? 1 : period === "7days" ? 7 : 30;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - (days - 1));
    const buckets = Array.from({ length: days }, (_, index) => {
      const date = new Date(dayStart);
      date.setDate(dayStart.getDate() + index);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      return {
        date,
        label: date.toLocaleDateString("en-PH", { day: "numeric", month: "short" }),
        count: items.filter((item) => {
          const created = new Date(item.createdAt);
          return `${created.getFullYear()}-${created.getMonth()}-${created.getDate()}` === dateKey;
        }).length,
      };
    });

    return {
      statusCounts,
      typeCounts,
      priorityCounts,
      scored,
      buckets,
      active: statusCounts.assigned + statusCounts.in_progress,
      awaiting: statusCounts.pending_review,
    };
  }, [items, period]);

  const exportCsv = () => {
    const rows = [
      ["Tracking ID", "Reported at", "Incident type", "Priority", "Status"],
      ...items.map((item) => [
        item.trackingCode,
        item.createdAt,
        item.incidentType ?? "Unclassified",
        item.priority?.band ?? "Unscored",
        item.status,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `sagip-analytics-${period}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking right away can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className={styles.page}>
      <DashboardTopBar
        lastUpdated={loadState.status === "ready" ? loadState.updatedAt : null}
        onRefresh={refresh}
        refreshDisabled={loadState.status === "loading"}
      />
      {reviewError && <p className={styles.auxiliaryError} role="status">{reviewError}</p>}

      {loadState.status === "loading" ? (
        <LoadingState />
      ) : loadState.status === "error" ? (
        <ErrorState message={loadState.message} onRetry={refresh} />
      ) : items.length === 0 ? (
        <EmptyState period={period} onPeriodChange={setPeriod} onRefresh={refresh} />
      ) : (
        <div className={styles.workspace}>
          <section className={styles.pageHeader}>
            <div>
              <div className={styles.titleLine}>
                <h1>Analytics</h1>
                <span className={styles.dateRange}>{formatDateRange(period)}</span>
              </div>
            </div>
            <div className={styles.pageActions}>
              <div className={styles.periodSelector} role="group" aria-label="Date range">
                {(["today", "7days", "30days"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    className={period === range ? styles.periodActive : ""}
                    aria-pressed={period === range}
                    onClick={() => setPeriod(range)}
                  >
                    {PERIOD_LABELS[range]}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.exportButton} onClick={exportCsv}>
                <DownloadIcon /> Export CSV
              </button>
            </div>
          </section>

          <section className={styles.kpiGrid} aria-label="Incident summary">
            <MetricCard label="Reports" value={items.length} note="" />
            <MetricCard label="Responding" value={metrics.active} tone="teal" note="" />
            <MetricCard
              label="Resolved"
              value={metrics.statusCounts.resolved}
              tone="green"
              note={percent(metrics.statusCounts.resolved, items.length)}
            />
            <MetricCard label="Rejected" value={metrics.statusCounts.rejected} tone="neutral" note={percent(metrics.statusCounts.rejected, items.length)} />
            <MetricCard label="Needs review" value={metrics.awaiting} tone="red" note="" />
          </section>

          <div className={styles.breakdownGrid}>
            <section className={styles.card}>
              <CardHeader
                title="By type"
                actionLabel={typeTable ? "View chart" : "View as table"}
                onAction={() => setTypeTable((value) => !value)}
              />
              {typeTable ? (
                <DataTable
                  headings={["Incident type", "Reports", "Share"]}
                  rows={metrics.typeCounts.map((entry) => [entry.label, String(entry.count), percent(entry.count, items.length)])}
                />
              ) : (
                <div className={styles.typeList}>
                  {metrics.typeCounts.map((entry) => (
                    <div className={styles.typeRow} key={entry.type}>
                      <div className={styles.typeLine}>
                        <span><TypeIcon type={entry.type} />{entry.label}</span>
                        <strong>{entry.count} <small>({percent(entry.count, items.length)})</small></strong>
                      </div>
                      <div className={styles.barTrack}><span style={{ width: `${items.length ? entry.count / items.length * 100 : 0}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.card}>
              <CardHeader
                title="By priority and status"
                actionLabel={flowTable ? "View chart" : "View as table"}
                onAction={() => setFlowTable((value) => !value)}
              />
              {flowTable ? (
                <DataTable
                  headings={["Status", "Reports", "Priority"]}
                  rows={LIFECYCLE.map((step) => [
                    statusLabel(step.status),
                    String(metrics.statusCounts[step.status]),
                    PRIORITIES.map((priority) => `${priority.band}: ${items.filter((item) => item.status === step.status && item.priority?.band === priority.band).length}`).join(" · "),
                  ])}
                />
              ) : (
                <div className={styles.flowContent}>
                  <div className={styles.sectionLabel}>
                    <span>Priority</span>
                    <span>{metrics.scored} scored</span>
                  </div>
                  <div className={styles.priorityBar} aria-label="Priority distribution">
                    {metrics.priorityCounts.map((priority) => (
                      <span key={priority.band} className={styles[`fill${priority.color}`]} style={{ width: `${metrics.scored ? priority.count / metrics.scored * 100 : 0}%` }} />
                    ))}
                  </div>
                  <div className={styles.priorityGrid}>
                    {metrics.priorityCounts.map((priority) => (
                      <div className={styles[`priority${priority.color}`]} key={priority.band}>
                        <strong>{priority.band} {priority.label}</strong>
                        <span>{priority.count} <small>({percent(priority.count, metrics.scored)})</small></span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.lifecycle}>
                    <p className={styles.sectionLabel}>Status</p>
                    <div className={styles.lifecycleGrid}>
                      {LIFECYCLE.map((step) => (
                        <div key={step.status}>
                          <span>{step.label}</span>
                          <i className={styles[`stage${step.color}`]} />
                          <strong>{metrics.statusCounts[step.status]}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  {metrics.scored < items.length && (
                    <p className={styles.unscoredNote}>{items.length - metrics.scored} incident(s) do not have a confirmed priority score.</p>
                  )}
                </div>
              )}
            </section>
          </div>

          <section className={styles.card}>
            <CardHeader
              title="Reports per day"
              actionLabel={timelineTable ? "View chart" : "View as table"}
              onAction={() => setTimelineTable((value) => !value)}
              badge={peakLabel(metrics.buckets)}
            />
            {timelineTable ? (
              <DataTable
                headings={["Date", "Incident reports"]}
                rows={metrics.buckets.map((bucket) => [bucket.label, String(bucket.count)])}
              />
            ) : (
              <TimelineChart buckets={metrics.buckets} />
            )}
          </section>

        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, note, tone = "default" }: {
  label: string;
  value: number;
  note: string;
  tone?: "default" | "teal" | "green" | "neutral" | "red";
}) {
  return (
    <article className={styles.kpiCard}>
      <p className={styles.kpiLabel}>{label}</p>
      <div className={styles.kpiValueLine}>
        <strong className={styles[`value${tone}`]}>{value.toLocaleString()}</strong>
        <span className={styles[`note${tone}`]}>{note}</span>
      </div>
    </article>
  );
}

function CardHeader({ title, actionLabel, onAction, badge }: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  badge?: string;
}) {
  return (
    <header className={styles.cardHeader}>
      <div>
        <h2>{title}</h2>
      </div>
      <div className={styles.cardActions}>
        {badge && <span className={styles.peakBadge}><PeakIcon />{badge}</span>}
        <button type="button" onClick={onAction} className={styles.viewButton}><TableIcon />{actionLabel}</button>
      </div>
    </header>
  );
}

function DataTable({ headings, rows }: { headings: string[]; rows: string[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.dataTable}>
        <thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>{cell}</td>)}</tr>
          )) : <tr><td colSpan={headings.length}>No records in this period.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TimelineChart({ buckets }: { buckets: { date: Date; label: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const labelStep = buckets.length > 10 ? Math.ceil(buckets.length / 7) : 1;

  return (
    <div className={styles.chartWrap} role="img" aria-label="Incident reports per day">
      <div className={styles.bars}>
        {buckets.map((bucket, index) => {
          const showLabel = buckets.length <= 10 || index % labelStep === 0 || index === buckets.length - 1;
          return (
            <div className={styles.barCol} key={bucket.label} title={`${bucket.label}: ${bucket.count}`}>
              <span className={styles.barValue}>{showLabel || bucket.count === max ? bucket.count : ""}</span>
              <span className={styles.barFill} style={{ height: `${(bucket.count / max) * 100}%` }} />
              <span className={styles.barLabel}>{showLabel ? bucket.label : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingWorkspace} aria-busy="true" aria-label="Loading analytics">
      <div className={styles.skeletonHeader} />
      <div className={styles.skeletonKpis}>{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
      <div className={styles.skeletonCards}><span /><span /></div>
      <div className={styles.skeletonChart} />
      <div className={styles.skeletonChart} />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className={styles.statePanel} aria-live="polite">
      <span className={`${styles.stateIcon} ${styles.errorIcon}`}><SyncErrorIcon /></span>
      <h1>Could not load analytics</h1>
      <p>{message}</p>
      <div className={styles.stateActions}>
        <button type="button" className={styles.retryButton} onClick={onRetry}><RefreshIcon />Retry</button>
      </div>
    </section>
  );
}

function EmptyState({ period, onPeriodChange, onRefresh }: {
  period: Period;
  onPeriodChange: (period: Period) => void;
  onRefresh: () => void;
}) {
  return (
    <section className={`${styles.statePanel} ${styles.emptyPanel}`} aria-live="polite">
      <span className={styles.stateIcon}><EmptyIcon /></span>
      <h1>No reports in this period</h1>
      <div className={styles.stateActions}>
        {period !== "7days" && <button type="button" className={styles.primaryButton} onClick={() => onPeriodChange("7days")}>Show last 7 days</button>}
        <button type="button" className={styles.secondaryButton} onClick={onRefresh}><RefreshIcon />Refresh</button>
      </div>
    </section>
  );
}

function TypeIcon({ type }: { type: string }) {
  const symbols: Record<string, string> = {
    flood: "⌂",
    fallen_debris: "♧",
    road_accident: "▣",
    structural_damage: "▦",
    fire: "♨",
    medical_emergency: "+",
    landslide: "⌁",
    other: "?",
    unclassified: "○",
  };
  return <span className={styles.typeIcon} aria-hidden="true">{symbols[type] ?? "•"}</span>;
}

function formatType(type: string) {
  return type.replaceAll("_", " ");
}

function statusLabel(status: string) {
  return formatType(status).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percent(value: number, total: number) {
  return total ? `${(value / total * 100).toFixed(1)}%` : "0.0%";
}

function formatDateRange(period: Period) {
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (period === "today" ? 0 : period === "7days" ? 6 : 29));
  const format = (date: Date) => new Intl.DateTimeFormat("en-PH", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  return `${format(start)} – ${format(end)}`;
}

function peakLabel(buckets: { date: Date; label: string; count: number }[]) {
  const peak = buckets.reduce((best, bucket) => bucket.count > best.count ? bucket : best, buckets[0]);
  return peak && peak.count > 0 ? `${peak.label} Peak (${peak.count} cases)` : "No daily peak";
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function loadIncidents(since: string): Promise<{ ok: true; items: Incident[] } | { ok: false; error: string }> {
  const items: Incident[] = [];
  let total = 0;
  let offset = 0;
  do {
    const result = await api<{ items: Incident[]; total: number }>(
      `/api/incidents?status=${REPORT_STATUSES.join(",")}&createdAfter=${encodeURIComponent(since)}&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    if (!result.ok) return { ok: false, error: result.error ?? "Could not load incident analytics." };
    total = result.data.total;
    items.push(...result.data.items);
    if (!result.data.items.length) {
      if (items.length < total) return { ok: false, error: "Incident loading stopped before all records were received." };
      break;
    }
    offset += result.data.items.length;
  } while (offset < total);
  return { ok: true, items };
}

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" /></svg>;
}
function TableIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M4 9h16M9 4v16" /></svg>;
}
function PeakIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5v15h16M7 15l4-4 3 2 5-6" /><path d="M15 7h4v4" /></svg>;
}
function RefreshIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></svg>;
}
function EmptyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M5 5h10l4 4v9M5 5v14h8" /></svg>;
}
function SyncErrorIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /><path d="M12 8v4m0 4h.01" /></svg>;
}
