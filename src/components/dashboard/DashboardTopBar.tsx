"use client";

import { useState } from "react";
import styles from "@/components/dashboard/DashboardShell.module.css";

export function DashboardTopBar({
  lastUpdated,
  onRefresh,
  refreshDisabled = false,
}: {
  lastUpdated: string | Date | null;
  onRefresh: () => void;
  refreshDisabled?: boolean;
}) {
  // Spin briefly so a click is visible even when the data has not changed.
  const [spinning, setSpinning] = useState(false);
  const updatedText = lastUpdated
    ? new Intl.DateTimeFormat("en-PH", {
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(lastUpdated instanceof Date ? lastUpdated : new Date(lastUpdated))
    : "Loading";

  return (
    <header className={styles.toolbar}>
      <div className={styles.toolbarUpdated}>
        <ClockIcon />
        <span>
          Updated{" "}
          <time suppressHydrationWarning>{updatedText}</time>
        </span>
      </div>
      <div className={styles.toolbarActions}>
        <button
          type="button"
          className={`${styles.toolbarRefresh} ${spinning ? styles.toolbarRefreshSpinning : ""}`}
          onClick={() => {
            setSpinning(true);
            window.setTimeout(() => setSpinning(false), 700);
            onRefresh();
          }}
          disabled={refreshDisabled}
          aria-label="Refresh dashboard"
          title="Refresh dashboard"
        >
          <RefreshIcon />
        </button>
      </div>
    </header>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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
