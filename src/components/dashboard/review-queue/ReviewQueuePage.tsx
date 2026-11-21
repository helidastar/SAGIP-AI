"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { CONFIDENCE_THRESHOLD, INCIDENT_TYPES, SEVERITY } from "@/lib/constants";
import { severityWithPercent } from "@/lib/severity-label";
import type { Severity } from "@/types";
import { DashboardQueueCountContext } from "@/components/dashboard/DashboardShell";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import styles from "./ReviewQueuePage.module.css";

interface QueueItem {
  id: string;
  trackingCode: string;
  description: string;
  photoUrl: string | null;
  area: string | null;
  status: string;
  stuck: boolean;
  keywordOnly: boolean;
  urgentUnverified: boolean;
  checkFirst: string[];
  draftPriority: { score: number; band: string } | null;
  createdAt: string;
  classification: {
    model: string;
    incidentType: string;
    severity: Severity;
    severityConfidence?: number | null;
    confidence: number;
    hazards: string[];
    hoaxSuspected?: boolean;
  } | null;
}

type LoadState = "loading" | "ready" | "error";

export function ReviewQueuePage() {
  const setQueueCount = useContext(DashboardQueueCountContext);
  const searchParams = useSearchParams();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("priority-desc");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [reviewItem, setReviewItem] = useState<QueueItem | null>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const closeReview = useCallback(() => {
    setReviewItem(null);
    window.requestAnimationFrame(() => reviewTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api<{ items: QueueItem[] }>("/api/review-queue").then((response) => {
      if (cancelled) return;
      setLastUpdated(new Date());
      if (!response.ok) {
        setState("error");
        setError(response.error);
        setQueueCount(null);
        return;
      }
      setItems(response.data.items);
      setState("ready");
      setQueueCount(response.data.items.length);
    });
    return () => {
      cancelled = true;
    };
  }, [request, setQueueCount]);

  const forcedState = process.env.NODE_ENV === "development"
    ? searchParams.get("state")
    : null;
  const effectiveState: LoadState | "empty" | "no-results" =
    forcedState === "loading" ? "loading"
      : forcedState === "error" ? "error"
        : forcedState === "empty" ? "empty"
          : forcedState === "no-results" ? "no-results"
            : state;

  const lowConfidenceCount = useMemo(
    () => items.filter(isLowConfidence).length,
    [items],
  );
  const highCriticalCount = useMemo(
    () => items.filter((item) => item.classification && ["high", "critical"].includes(item.classification.severity)).length,
    [items],
  );
  const medianWait = useMemo(() => {
    if (items.length === 0 || !lastUpdated) return null;
    const waits = items
      .map((item) => lastUpdated.getTime() - new Date(item.createdAt).getTime())
      .filter((wait) => Number.isFinite(wait) && wait >= 0)
      .sort((a, b) => a - b);
    if (waits.length === 0) return null;
    const middle = Math.floor(waits.length / 2);
    return waits.length % 2 ? waits[middle] : (waits[middle - 1] + waits[middle]) / 2;
  }, [items, lastUpdated]);

  const lowConfidenceShare = items.length > 0
    ? Math.round((lowConfidenceCount / items.length) * 100)
    : 0;

  const reasonCounts = useMemo(() => ({
    all: items.length,
    low: items.filter(isLowConfidence).length,
    critical: items.filter((item) => item.classification?.severity === "critical").length,
    high: items.filter((item) => item.classification?.severity === "high").length,
  }), [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (query && ![
        item.trackingCode,
        item.area ?? "",
        item.description,
      ].some((value) => value.toLowerCase().includes(query))) return false;
      if (severityFilter !== "all" && item.classification?.severity !== severityFilter) return false;
      if (typeFilter !== "all" && item.classification?.incidentType !== typeFilter) return false;
      if (reasonFilter === "LOW_CONF" && !isLowConfidence(item)) return false;
      if (reasonFilter === "CRITICAL" && item.classification?.severity !== "critical") return false;
      if (reasonFilter === "HIGH_SEV" && item.classification?.severity !== "high") return false;
      return true;
    });

    return filtered
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        let comparison = 0;
        if (sort === "conf-asc") {
          comparison = (a.item.classification?.confidence ?? 1) - (b.item.classification?.confidence ?? 1);
        } else if (sort === "wait-desc") {
          comparison = new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime();
        } else {
          comparison = (b.item.draftPriority?.score ?? -1) - (a.item.draftPriority?.score ?? -1);
        }
        return comparison || a.index - b.index;
      })
      .map(({ item }) => item);
  }, [items, search, severityFilter, typeFilter, reasonFilter, sort]);

  function resetFilters() {
    setSearch("");
    setSeverityFilter("all");
    setTypeFilter("all");
    setSort("priority-desc");
    setReasonFilter("ALL");
  }

  function refreshQueue() {
    setState("loading");
    setError(null);
    setRequest((value) => value + 1);
  }

  return (
    <div className={styles.page} data-review-queue-page>
      <DashboardTopBar
        lastUpdated={lastUpdated}
        onRefresh={refreshQueue}
        refreshDisabled={state === "loading"}
      />
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.titleLine}>
            <h1>Review Queue</h1>
            <span className={styles.countBadge}>
              {effectiveState === "ready" ? `${items.length} incidents requiring review` : "Incidents requiring review"}
            </span>
          </div>
          <p>Low confidence or high severity, awaiting human classification</p>
        </div>
      </header>

      <div className={styles.main}>
        <section className={styles.rulesBanner} aria-label="Review rules">
          <strong>MANDATORY REVIEW</strong>
          <span>
            Incidents with AI confidence below 70% or high/critical severity require human review.
            Incidents are not dispatched automatically. Bulk approval is not available.
          </span>
        </section>

        {effectiveState === "ready" && (
          <section className={styles.stats} aria-label="Review queue summary">
            <StatCard label="Total flagged" value={String(items.length)} detail="Awaiting manual review" />
            {items.length > 0 && (
              <StatCard
                label="Low confidence (<70%)"
                value={String(lowConfidenceCount)}
                detail={`${lowConfidenceShare}% of backlog`}
                tone="amber"
              />
            )}
            {items.length > 0 && (
              <StatCard
                label="High / Critical"
                value={String(highCriticalCount)}
                detail="Human verification required"
                tone="red"
              />
            )}
            {medianWait !== null && (
              <StatCard
                label="Median queue wait"
                value={formatDuration(medianWait)}
                detail="Since report submission"
                tone="teal"
              />
            )}
          </section>
        )}

        {(effectiveState === "ready" || effectiveState === "no-results") && (
          <section className={styles.controls} aria-label="Review queue controls">
            <div className={styles.controlTop}>
              <label className={styles.searchBox}>
                <SearchIcon />
                <span className={styles.srOnly}>Search review queue</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search reference ID, area, or description..."
                  type="search"
                />
              </label>
              <div className={styles.selects}>
                <label>
                  <span className={styles.srOnly}>Severity</span>
                  <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                    <option value="all">All Severities</option>
                    {Object.keys(SEVERITY).map((severity) => (
                      <option value={severity} key={severity}>{titleCase(severity)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={styles.srOnly}>Incident type</span>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="all">All Incident Types</option>
                    {INCIDENT_TYPES.map((type) => (
                      <option value={type} key={type}>{titleCase(type)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={styles.srOnly}>Sort order</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option value="priority-desc">Priority Score (High to Low)</option>
                    <option value="wait-desc">Queue Wait (Longest First)</option>
                    <option value="conf-asc">Confidence (Lowest First)</option>
                  </select>
                </label>
                <button type="button" className={styles.resetButton} onClick={resetFilters}>
                  <FilterOffIcon />
                  Reset
                </button>
              </div>
            </div>
            <div className={styles.controlBottom}>
              <div className={styles.reasonFilters}>
                <span className={styles.filterLabel}><FilterIcon /> Filter by Reason:</span>
                <ReasonChip
                  label="All"
                  count={reasonCounts.all}
                  active={reasonFilter === "ALL"}
                  onClick={() => setReasonFilter("ALL")}
                />
                <ReasonChip
                  label="Low Conf (<70%)"
                  count={reasonCounts.low}
                  active={reasonFilter === "LOW_CONF"}
                  onClick={() => setReasonFilter("LOW_CONF")}
                  tone="amber"
                />
                <ReasonChip
                  label="Critical"
                  count={reasonCounts.critical}
                  active={reasonFilter === "CRITICAL"}
                  onClick={() => setReasonFilter("CRITICAL")}
                  tone="critical"
                />
                <ReasonChip
                  label="High"
                  count={reasonCounts.high}
                  active={reasonFilter === "HIGH_SEV"}
                  onClick={() => setReasonFilter("HIGH_SEV")}
                  tone="high"
                />
              </div>
              <span className={styles.activeCount}>Active triage queue: {filteredItems.length} incidents</span>
            </div>
          </section>
        )}

        {effectiveState === "loading" && (
          <section className={styles.skeletonPanel} aria-busy="true" aria-label="Loading review queue">
            <div className={styles.skeletonHeader} />
            {[0, 1, 2, 3, 4].map((row) => (
              <div className={styles.skeletonRow} key={row}>
                <span /><span /><span /><span />
              </div>
            ))}
            <p>Loading review queue...</p>
          </section>
        )}

        {effectiveState === "error" && (
          <section className={styles.stateCard} role="alert">
            <span className={styles.errorIcon}><OfflineIcon /></span>
            <h2>Could not load the review queue</h2>
            <p>{forcedState === "error" ? "The review queue could not be loaded." : error}</p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setState("loading");
                setError(null);
                setRequest((value) => value + 1);
              }}
            >
              Retry
            </button>
          </section>
        )}

        {effectiveState === "empty" && (
          <section className={styles.stateCard}>
            <span className={styles.successIcon}><CheckIcon /></span>
            <h2>Nothing to review</h2>
          </section>
        )}

        {effectiveState === "no-results" && (
          <section className={styles.stateCard}>
            <h2>No matching incidents</h2>
            <p>There are no review items matching the current filters.</p>
            <button type="button" className={styles.primaryButton} onClick={resetFilters}>Clear filters</button>
          </section>
        )}

        {effectiveState === "ready" && items.length === 0 && (
          <section className={styles.stateCard}>
            <span className={styles.successIcon}><CheckIcon /></span>
            <h2>Nothing to review</h2>
          </section>
        )}

        {effectiveState === "ready" && items.length > 0 && filteredItems.length === 0 && (
          <section className={styles.stateCard}>
            <h2>No matching incidents</h2>
            <p>There are no review items matching the current filters.</p>
            <button type="button" className={styles.primaryButton} onClick={resetFilters}>Clear filters</button>
          </section>
        )}

        {effectiveState === "ready" && filteredItems.length > 0 && (
          <section className={styles.tablePanel} aria-label="Review queue incidents">
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Incident &amp; location</th>
                    <th scope="col">Queue wait</th>
                    <th scope="col">Priority / Score</th>
                    <th scope="col">AI assessment &amp; confidence</th>
                    <th scope="col">Review reason</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <ReviewRow
                      key={item.id}
                      item={item}
                      now={lastUpdated?.getTime() ?? null}
                      onReview={(trigger) => {
                        reviewTriggerRef.current = trigger;
                        setReviewItem(item);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <footer className={styles.footer}>
              Showing {filteredItems.length} of {items.length} items awaiting review
            </footer>
          </section>
        )}
      </div>
      {reviewItem && (
        <ReviewModal
          item={reviewItem}
          onClose={closeReview}
          onDone={() => {
            setItems((all) => all.filter((item) => item.id !== reviewItem.id));
            setQueueCount(Math.max(0, items.length - 1));
            setReviewItem(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "amber" | "red" | "teal";
}) {
  return (
    <article className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={tone ? styles[`statValue${titleCase(tone)}`] : styles.statValue}>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function ReasonChip({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "amber" | "critical" | "high";
}) {
  return (
    <button
      type="button"
      className={`${styles.reasonChip} ${active ? styles.reasonChipActive : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {tone && <span className={`${styles.reasonDot} ${styles[`reasonDot${titleCase(tone)}`]}`} aria-hidden="true" />}
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function ReviewModal({
  item,
  onClose,
  onDone,
}: {
  item: QueueItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [finalType, setFinalType] = useState(item.classification?.incidentType ?? "other");
  const [finalSeverity, setFinalSeverity] = useState<string>(item.classification?.severity ?? "moderate");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function send(body: object) {
    setBusy(true);
    setError(null);
    const response = await api<{ status: string }>(`/api/reports/${item.id}/review`, {
      method: "POST",
      json: body,
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setSaved(true);
  }

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
      >
        <header className={styles.modalHeader}>
          <div>
            <span className={styles.modalReference}>{item.trackingCode}</span>
            <h2 id="review-dialog-title">Confirm classification</h2>
          </div>
          <button ref={closeRef} type="button" className={styles.modalClose} onClick={onClose} aria-label="Close review dialog">
            <CloseIcon />
          </button>
        </header>
        <div className={styles.modalBody}>
          <div className={styles.modalIncident}>
            {item.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.photoUrl} alt="Report photo" />
            ) : (
              <div className={styles.noPhoto}>No photo</div>
            )}
            <div>
              <strong>{item.classification ? titleCase(item.classification.incidentType) : "Unclassified"}</strong>
              <p>{item.description || "No description"}</p>
              <span>{item.area ?? "Unknown area"}</span>
            </div>
          </div>
          <div className={styles.modalFields}>
            <label>
              <span>Final type</span>
              <select value={finalType} onChange={(event) => setFinalType(event.target.value)}>
                {INCIDENT_TYPES.map((type) => (
                  <option value={type} key={type}>{titleCase(type)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Final severity</span>
              <select value={finalSeverity} onChange={(event) => setFinalSeverity(event.target.value)}>
                {Object.keys(SEVERITY).map((severity) => (
                  <option value={severity} key={severity}>{titleCase(severity)}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.notesField}>
            <span>Reviewer notes</span>
            <textarea value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {error && <p className={styles.modalError} role="alert">{error}</p>}
          {saved && <p className={styles.modalSaved}>Action recorded in the audit log</p>}
        </div>
        <footer className={styles.modalFooter}>
          <button type="button" className={styles.dangerButton} disabled={busy || saved} onClick={() => {
            if (window.confirm(`Mark ${item.trackingCode} as a false alarm? It will be rejected and leave the queue.`)) void send({ reject: true, notes });
          }}>
            Mark false alarm
          </button>
          <button type="button" className={styles.confirmButton} disabled={busy || saved} onClick={() => void send({ finalType, finalSeverity, notes })}>
            {busy ? "Saving..." : "Confirm classification"}
          </button>
          {saved && (
            <button type="button" className={styles.confirmButton} onClick={onDone}>Done</button>
          )}
        </footer>
      </div>
    </div>
  );
}

function ReviewRow({
  item,
  now,
  onReview,
}: {
  item: QueueItem;
  now: number | null;
  onReview: (trigger: HTMLButtonElement) => void;
}) {
  const classification = item.classification;
  const reasons = reviewReasons(item);
  const [copied, setCopied] = useState(false);
  async function copyReference() {
    try {
      await navigator.clipboard.writeText(item.trackingCode);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <tr
      className={styles.clickableRow}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) return;
        const button = event.currentTarget.querySelector<HTMLButtonElement>("[data-review-button]");
        if (button) onReview(button);
      }}
    >
      <td data-label="Reference">
        <div className={styles.referenceCell}>
          <button
            type="button"
            className={styles.copyButton}
            aria-label={`Copy reference ${item.trackingCode}`}
            onClick={() => void copyReference()}
          >
            <CopyIcon />
          </button>
          <span>{copied ? "Copied" : item.trackingCode}</span>
        </div>
      </td>
      <td data-label="Incident type and description">
        <div className={styles.incidentCell}>
          <IncidentIcon type={classification?.incidentType} />
          <div>
            <strong>{classification ? titleCase(classification.incidentType) : "Unclassified"}</strong>
            <p>{item.description || "No description"}</p>
            <span className={styles.areaLine}>{item.area ?? "Unknown area"}</span>
          </div>
        </div>
      </td>
      <td data-label="Queue wait">
        <div className={styles.waitCell}>
          <strong>{now ? `${formatDuration(now - new Date(item.createdAt).getTime())} ago` : "Unknown wait"}</strong>
          <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
        </div>
      </td>
      <td data-label="Priority and score">
        {item.draftPriority ? (
          <span className={`${styles.priorityBadge} ${styles[priorityClass(item.draftPriority.band)]}`}>
            {priorityIcon(item.draftPriority.band)}
            <span>{priorityLabel(item.draftPriority.band)}</span>
            <strong>{item.draftPriority.score.toFixed(1)}<small>/100</small></strong>
          </span>
        ) : (
          <span className={styles.mutedValue}>No score yet</span>
        )}
      </td>
      <td data-label="AI assessment">
        {classification ? (
          <div className={styles.assessmentCell}>
            <strong>{titleCase(classification.incidentType)}</strong>
            <span>{severityWithPercent(classification.severity, classification.severityConfidence)}</span>
            <span className={classification.confidence < CONFIDENCE_THRESHOLD ? styles.lowConfidence : ""}>
              Confidence {Math.round(classification.confidence * 100)}%
            </span>
          </div>
        ) : (
          <span className={styles.mutedValue}>No AI result yet</span>
        )}
      </td>
      <td data-label="Review reason">
        <div className={styles.reasonTags}>
          {reasons.map((reason) => (
            <span className={styles.reasonTag} key={reason}>{reason}</span>
          ))}
        </div>
      </td>
      <td data-label="Action" className={styles.actionCell}>
        <button type="button" data-review-button className={styles.reviewButton} onClick={(event) => onReview(event.currentTarget)}>
          Review
          <ChevronIcon />
        </button>
      </td>
    </tr>
  );
}

/** Same rule as the server's check-first trigger: type or severity confidence below the threshold. */
function isLowConfidence(item: QueueItem) {
  if (item.checkFirst.includes("low_confidence")) return true;
  const c = item.classification;
  if (!c) return false;
  return c.confidence < CONFIDENCE_THRESHOLD || (c.severityConfidence != null && c.severityConfidence < CONFIDENCE_THRESHOLD);
}

function reviewReasons(item: QueueItem) {
  const reasons: string[] = [];
  if (item.urgentUnverified) reasons.push("Urgent · no AI");
  if (item.classification?.severity === "critical") reasons.push("Critical");
  else if (item.classification?.severity === "high") reasons.push("High");
  if (isLowConfidence(item)) reasons.push("Low confidence");
  if (!item.classification) reasons.push("No AI result");
  if (item.classification?.hoaxSuspected) reasons.push("Possible hoax");
  if (item.checkFirst.includes("possible_hoax") && !reasons.includes("Possible hoax")) reasons.push("Possible hoax");
  return reasons;
}

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function priorityClass(band: string) {
  const normalized = band.toUpperCase();
  if (normalized === "P1" || normalized === "IMMEDIATE") return "priorityP1";
  if (normalized === "P2" || normalized === "URGENT") return "priorityP2";
  if (normalized === "P3" || normalized === "STANDARD") return "priorityP3";
  return "priorityP4";
}

function priorityIcon(band: string) {
  const normalized = band.toUpperCase();
  if (normalized === "P2" || normalized === "URGENT") return <AlertCircleIcon />;
  if (normalized === "P3" || normalized === "STANDARD") return <InfoIcon />;
  if (normalized === "P4" || normalized === "LOW") return <MinusCircleIcon />;
  return <WarningIcon />;
}

function priorityLabel(band: string) {
  const normalized = band.toUpperCase();
  if (normalized === "P1" || normalized === "IMMEDIATE") return "P1 Immediate";
  if (normalized === "P2" || normalized === "URGENT") return "P2 Urgent";
  if (normalized === "P3" || normalized === "STANDARD") return "P3 Standard";
  if (normalized === "P4" || normalized === "LOW") return "P4 Low";
  return titleCase(band);
}

function IncidentIcon({ type }: { type?: string }) {
  return (
    <span className={styles.incidentIcon} aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        {type === "fire" ? (
          <path d="M10 2c1 4-3 5-3 8 0 2 1 3 3 4-1-3 3-4 3-7 2 2 3 4 3 6a6 6 0 0 1-12 0c0-4 3-7 6-11Z" />
        ) : type === "flood" ? (
          <path d="M3 7c2-2 4 2 6 0s4 2 8 0M3 12c2-2 4 2 6 0s4 2 8 0M3 17c2-2 4 2 6 0s4 2 8 0" />
        ) : (
          <path d="M10 2 2 17h16L10 2Zm0 5v5m0 3v1" />
        )}
      </svg>
    </span>
  );
}

function CopyIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="7" y="3" width="10" height="12" rx="1" /><path d="M13 15v2H3V5h4" /></svg>;
}
function WarningIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M10 2 2 18h16L10 2Z" /><path d="M10 7v5m0 3v1" /></svg>;
}
function AlertCircleIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="M10 5v6m0 3v1" /></svg>;
}
function InfoIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="M10 9v5m0-8v1" /></svg>;
}
function MinusCircleIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="M6 10h8" /></svg>;
}
function CheckIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="m6 10 3 3 5-6" /></svg>;
}
function OfflineIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 3 14 14M8.5 6.5A6 6 0 0 1 16 10M4 10a6 6 0 0 1 1-3M7 13a4 4 0 0 1 6 0M10 16h.01" /></svg>;
}
function SearchIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>;
}
function FilterIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 5h14M5 10h10M8 15h4" /></svg>;
}
function FilterOffIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 4h14l-5 6v4l-4 2v-6L3 4Zm12 12 3 3M18 16l-3 3" /></svg>;
}
function ChevronIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>;
}
function CloseIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 4 12 12M16 4 4 16" /></svg>;
}
