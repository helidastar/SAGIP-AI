"use client";

import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { DashboardQueueCountContext } from "@/components/dashboard/DashboardShell";
import styles from "@/components/dashboard/Dashboard.module.css";
import type { Severity } from "@/types";

interface ReviewQueueItem {
  id: string;
  trackingCode: string;
  description: string;
  area: string | null;
  status: string;
  createdAt: string;
  checkFirst: string[];
  urgentUnverified: boolean;
  classification: {
    incidentType: string;
    severity: Severity;
    confidence: number;
  } | null;
}

type ReviewResult =
  | { request: number; status: "ready"; items: ReviewQueueItem[] }
  | { request: number; status: "error"; error: string };

export function DashboardReviewQueuePanel() {
  const setQueueCount = useContext(DashboardQueueCountContext);
  const [request, setRequest] = useState(0);
  const [result, setResult] = useState<ReviewResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ items: ReviewQueueItem[] }>("/api/review-queue").then((response) => {
      if (cancelled) return;
      if (!response.ok) {
        setResult({
          request,
          status: "error",
          error: response.error ?? "Could not load review queue",
        });
        return;
      }
      setResult({ request, status: "ready", items: response.data.items });
    });
    return () => {
      cancelled = true;
    };
  }, [request]);

  const current = result?.request === request ? result : null;
  const loading = current === null;
  const items = current?.status === "ready" ? current.items : [];
  const error = current?.status === "error" ? current.error : null;

  useEffect(() => {
    setQueueCount(current?.status === "ready" ? current.items.length : null);
  }, [current, setQueueCount]);

  useEffect(() => {
    const refresh = () => setRequest((value) => value + 1);
    window.addEventListener("sagip-dashboard-refresh", refresh);
    return () => window.removeEventListener("sagip-dashboard-refresh", refresh);
  }, []);

  return (
    <section className={styles.reviewPanel} aria-labelledby="dashboard-review-title" aria-busy={loading}>
      <header className={styles.reviewHeading}>
        <div className={styles.reviewHeadingText}>
          <h2 id="dashboard-review-title" className={styles.reviewTitle}>Review queue, flagged</h2>
          <p className={styles.reviewSubtitle}>AI drafts awaiting staff confirmation</p>
        </div>
        <div className={styles.reviewActions}>
          <span className={styles.reviewCount}>
            {loading ? "Loading" : error ? "Unavailable" : `${items.length} waiting`}
          </span>
          <Link href="/dashboard/review" className={styles.textLink}>Open queue</Link>
        </div>
      </header>
      <div className={styles.reviewBody}>
        {loading ? (
          <p className={styles.reviewMessage} aria-busy="true">Loading review queue...</p>
        ) : error ? (
          <div className={styles.reviewError} role="alert">
            <span>{error}</span>
            <button type="button" className={styles.retryButton} onClick={() => setRequest((value) => value + 1)}>
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className={styles.reviewMessage}>Nothing to review</p>
        ) : (
          <ul className={styles.reviewRows}>
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className={styles.reviewRow}>
                <div className={styles.reviewItem}>
                  <span className={styles.priorityBadge} aria-hidden="true">
                    {item.urgentUnverified ? "!" : item.checkFirst.length ? "?" : "•"}
                  </span>
                  <span className={styles.incidentCopy}>
                    <span>
                      <span className={styles.reviewType}>
                        {item.classification?.incidentType.replaceAll("_", " ") ?? "Unclassified"}
                      </span>
                      <span className={styles.reviewCode}>{item.trackingCode}</span>
                    </span>
                    <span className={styles.reviewMeta}>
                      {item.area ?? "Unknown area"} · {item.description || "No description"} ·{" "}
                      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                    </span>
                  </span>
                  <span className={styles.reviewFlags}>
                    {item.checkFirst.length > 0 && (
                      <span className={`${styles.reviewFlag} ${styles.reviewFlagStrong}`}>Check first</span>
                    )}
                    {item.classification?.severity && (
                      <span className={styles.reviewFlag}>{item.classification.severity}</span>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
