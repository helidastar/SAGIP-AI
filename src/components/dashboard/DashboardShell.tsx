"use client";

import Link from "next/link";
import { createContext, useState, type ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { StaffUser } from "@/components/dashboard/StaffProvider";
import styles from "@/components/dashboard/DashboardShell.module.css";

export const DashboardQueueCountContext = createContext<(count: number | null) => void>(() => {});

const dashboardUiFont = Inter({
  subsets: ["latin"],
  variable: "--font-dashboard-ui",
});

const dashboardMonoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-dashboard-mono",
});

export function DashboardShell({
  staff,
  error,
  onLogout,
  children,
}: {
  staff: StaffUser | null;
  error: string | null;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  return (
    <DashboardQueueCountContext.Provider value={setReviewCount}>
      <div
        className={`${styles.dashboard} ${dashboardUiFont.variable} ${dashboardMonoFont.variable}`}
        data-dashboard-shell
      >
        <div className={styles.shell}>
          <aside className={styles.sidebar} aria-label="Dashboard sidebar">
            <Link href="/dashboard" className={styles.brand} aria-label="SAGIP-AI home">
              <span className={styles.brandMark} aria-hidden="true"><ShieldIcon /></span>
              <span className={styles.brandName}>
                <strong>SAGIP-AI</strong>
                <span>Ops portal</span>
              </span>
            </Link>

            <p className={styles.navHeading}>EOC Navigation</p>
            <nav aria-label="Primary">
              <ul className={styles.navList}>
                <li>
                  <Link href="/dashboard" className={`${styles.navLink} ${styles.navLinkActive}`} aria-current="page">
                    <GridIcon />
                    <span>Ranked List</span>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/review" className={styles.navLink}>
                    <ReviewIcon />
                    <span>Review Queue</span>
                    {reviewCount !== null && (
                      <span className={styles.navBadge} aria-label={`${reviewCount} waiting`}>
                        {reviewCount}
                      </span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/analytics" className={styles.navLink}>
                    <AnalyticsIcon />
                    <span>Analytics</span>
                  </Link>
                </li>
              </ul>
            </nav>

            <div className={styles.account}>
              <span className={styles.avatar} aria-hidden="true"><UserIcon /></span>
              <span className={styles.accountName}>
                <strong>{staff?.fullName ?? staff?.email ?? ""}</strong>
                {staff && <span>{staff.role}</span>}
              </span>
              <button
                type="button"
                className={styles.logoutButton}
                onClick={onLogout}
                aria-label="Log out"
                title="Log out"
              >
                <LogoutIcon />
              </button>
            </div>
          </aside>

          <div className={styles.mainColumn}>
            <main className={styles.content}>
              {error ? (
                <p className={styles.authError} role="alert">{error}</p>
              ) : staff ? (
                children
              ) : (
                <p className={styles.authLoading} aria-busy="true">Loading staff session...</p>
              )}
            </main>
          </div>
        </div>
      </div>
    </DashboardQueueCountContext.Provider>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 5h16v15H4zM8 3v4m8-4v4M7 11h10m-10 4h6" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 16v-4m4 4V8m4 8v-6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.6-2.7 7.9-7 10-4.3-2.1-7-5.4-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c.8-3.1 3-4.7 6.5-4.7s5.7 1.6 6.5 4.7" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M10 4H5v16h5m5-4 4-4-4-4m4 4H9" />
    </svg>
  );
}
