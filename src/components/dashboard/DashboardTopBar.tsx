"use client";

import { useState } from "react";
import { useStaff } from "@/components/dashboard/StaffProvider";
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
  const staff = useStaff();
  // Spin briefly so a click is visible even when the data has not changed.
  const [spinning, setSpinning] = useState(false);
  const updatedText = lastUpdated
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Manila",
      }).format(lastUpdated instanceof Date ? lastUpdated : new Date(lastUpdated))
    : "Synchronizing";

  return (
    <header className={styles.toolbar}>
      <div className={styles.toolbarUpdated}>
        <ClockIcon />
        <span>
          Last updated:{" "}
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
        {staff && (
          <span className={styles.toolbarUser}>
            <span className={styles.toolbarUserName}>
              <strong>{staff.fullName ?? staff.email}</strong>
              <span>{staff.role}</span>
            </span>
            <span className={styles.toolbarAvatar} aria-hidden="true">
              <UserIcon />
            </span>
          </span>
        )}
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

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.8-3.1 3-4.7 6.5-4.7s5.7 1.6 6.5 4.7" />
    </svg>
  );
}
