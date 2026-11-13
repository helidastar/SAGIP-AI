"use client";

import { useEffect, useState } from "react";

export function DashboardHeader({
  name,
  role,
}: {
  name: string;
  role: "admin" | "responder";
}) {
  const [lastUpdated, setLastUpdated] = useState<{ display: string; iso: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = new Date();
      setLastUpdated({
        display: new Intl.DateTimeFormat("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Manila",
        }).format(now),
        iso: now.toISOString(),
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-status">
        <span className="dashboard-active-pill">
          <span className="dashboard-active-indicator" aria-hidden="true" />
          EOC active <span aria-hidden="true">·</span> Level 1
        </span>
        <span className="dashboard-updated">
          <ClockIcon />
          <span>
            Last updated:{" "}
            <time dateTime={lastUpdated?.iso}>{lastUpdated?.display ?? "Synchronizing"}</time>
          </span>
        </span>
      </div>
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">
            <span className="dashboard-live-dot" aria-hidden="true" />
            Responder / Admin Dashboard
          </p>
          <p className="dashboard-subtitle">
            Real-time geospatial dispatch engine <span aria-hidden="true">•</span>{" "}
            Barangay DRRM Emergency Center
          </p>
        </div>
        <div className="dashboard-user-summary">
          <span className="dashboard-user-avatar" aria-hidden="true">
            <UserIcon />
          </span>
          <span className="dashboard-user-text">
            <span className="dashboard-user-name">{name}</span>
            <span className="dashboard-user-role">{role}</span>
          </span>
        </div>
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

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.8-3.1 3-4.7 6.5-4.7s5.7 1.6 6.5 4.7" />
    </svg>
  );
}
