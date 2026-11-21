"use client";

import { useEffect, useState } from "react";
import styles from "@/components/dashboard/Dashboard.module.css";

export function DashboardHeader({
  name,
  role,
}: {
  name: string;
  role: "admin" | "responder" | null;
}) {
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setLastUpdated(formatDate(new Date())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function refresh() {
    setLastUpdated(formatDate(new Date()));
    window.dispatchEvent(new Event("sagip-dashboard-refresh"));
  }

  return (
    <>
      <div className={styles.topBar}>
        <span className={styles.activePill}>
          <span className={styles.activeDot} aria-hidden="true" />
          EOC active <span aria-hidden="true">·</span> Level 1
        </span>
        <span className={styles.lastUpdated}>
          <ClockIcon />
          <span>
            Last updated:{" "}
            <time suppressHydrationWarning>{lastUpdated || "Synchronizing"}</time>
          </span>
        </span>
        <span className={styles.topBarSpacer} />
        <span className={styles.headerButton} role="img" aria-label="Notifications">
          <BellIcon />
        </span>
        <span className={styles.headerButton} aria-hidden="true">
          <UserIcon />
        </span>
      </div>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitleWrap}>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.pageSubtitle}>
            Real-time geospatial dispatch engine <span aria-hidden="true">•</span>{" "}
            Barangay DRRM Emergency Center
          </p>
        </div>
        <div className={styles.identity}>
          <span className={styles.identityName}>{name}</span>
          {role && <span className={styles.roleBadge}>{role}</span>}
        </div>
        <button
          type="button"
          className={styles.headerButton}
          onClick={refresh}
          aria-label="Refresh dashboard"
          title="Refresh dashboard"
        >
          <RefreshIcon />
        </button>
      </header>
    </>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" />
      <path d="M19 3v4m-2-2h4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.8-3.1 3-4.7 6.5-4.7s5.7 1.6 6.5 4.7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.5-4L4 9m0-4v4h4m-4 4a8 8 0 0 0 14.5 4L20 15m0 4v-4h-4" />
    </svg>
  );
}
