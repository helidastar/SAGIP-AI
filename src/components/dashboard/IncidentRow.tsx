"use client";

import Link from "next/link";
import { memo } from "react";
import type { Severity } from "@/types";
import { stepFor } from "@/lib/workflow";
import styles from "@/components/dashboard/Dashboard.module.css";

export interface DashboardIncident {
  id: string;
  trackingCode: string;
  description: string;
  status: string;
  incidentType: string | null;
  severity: Severity | null;
  location: { lat: number; lng: number; area: string | null };
  priority: { score: number; band: string; overridden: boolean } | null;
  createdAt: string;
}

export const IncidentRow = memo(function IncidentRow({
  incident,
  role,
  selected,
  onSelect,
}: {
  incident: DashboardIncident;
  role: "admin" | "responder" | null;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const step = stepFor(incident.status);
  const action = step?.key === "review"
    ? "Needs review"
    : step?.key === "assign"
      ? "Assign a team"
      : step?.key === "respond"
        ? "Team responding"
        : step?.next ?? incident.status.replaceAll("_", " ");
  const actionActor = step?.key === "assign"
    ? "Admin action"
    : step?.key === "ai"
      ? "AI · automatic"
      : step?.actor && step.actor !== "—"
        ? step.actor
        : null;
  const assignDisabled = step?.key === "assign" && role !== "admin";
  const statusClass = step?.key === "review"
    ? styles.statusReview
    : step?.key === "assign"
      ? styles.statusAssign
      : step?.key === "done"
        ? styles.statusResolved
        : "";

  return (
    <li className={styles.incidentRow}>
      <Link
        href={`/dashboard/incidents/${incident.id}`}
        className={`${styles.incidentLink} ${selected ? styles.incidentLinkSelected : ""}`}
        onFocus={() => onSelect(incident.id)}
        onMouseEnter={() => onSelect(incident.id)}
      >
        <PriorityBadge band={incident.priority?.band} />
        <span className={styles.incidentCopy}>
          <span className={styles.incidentTopline}>
            <span className={styles.incidentType}>
              {incident.incidentType?.replaceAll("_", " ") ?? "Unconfirmed"}
            </span>
            <SeverityTag severity={incident.severity} />
            <span className={styles.trackingCode}>{incident.trackingCode}</span>
          </span>
          <span className={styles.incidentDescription}>
            {incident.description || "No description provided"}
          </span>
          <span className={styles.incidentMeta}>
            <span className={styles.area}>{incident.location.area ?? "Unknown area"}</span>
            <span aria-hidden="true">·</span>
            <time className={styles.timestamp} dateTime={incident.createdAt}>
              {new Date(incident.createdAt).toLocaleString()}
            </time>
          </span>
        </span>
        <span className={styles.incidentTrailing}>
        {incident.priority && Number.isFinite(incident.priority.score) && (
          <span className={styles.scoreStack}>
            <span className={styles.scoreLabel}>Score</span>
            <span className={styles.score}>
              {incident.priority.score}
            </span>
            </span>
          )}
          {incident.priority?.overridden && (
            <span className={styles.statusTag}>
              <OverrideIcon />
              Override
            </span>
          )}
        <StatusAction
          label={action}
          actor={actionActor}
          className={statusClass}
          status={incident.status}
          disabled={assignDisabled}
        />
        </span>
      </Link>
    </li>
  );
});

export function PriorityBadge({ band }: { band?: string | null }) {
  const priorityClass = band === "P1"
    ? styles.priorityP1
    : band === "P2"
      ? styles.priorityP2
      : band === "P3"
        ? styles.priorityP3
        : band === "P4"
          ? styles.priorityP4
          : `${styles.priorityNone} ${styles.dashedPriority}`;
  return (
    <span className={`${styles.priorityBadge} ${priorityClass}`} aria-label={band ? `Priority ${band}` : "Priority unconfirmed"}>
      {band ?? "–"}
    </span>
  );
}

function SeverityTag({ severity }: { severity: Severity | null }) {
  const severityClass = severity === "critical"
    ? styles.severityCritical
    : severity === "high"
      ? styles.severityHigh
      : severity === "moderate"
        ? styles.severityModerate
        : severity === "low"
          ? styles.severityLow
          : styles.severityUnconfirmed;
  const label = severity ? `${severity[0].toUpperCase()}${severity.slice(1)}` : "Unconfirmed";
  return (
    <span className={`${styles.severityTag} ${severityClass}`} aria-label={severity ? `${label} severity` : "Severity unconfirmed"}>
      <SeverityIcon severity={severity} />
      {label}
    </span>
  );
}

function StatusAction({
  status,
  label,
  actor,
  className,
  disabled,
}: {
  status: string;
  label: string;
  actor: string | null;
  className: string;
  disabled: boolean;
}) {
  return (
    <span
      className={`${styles.statusTag} ${className} ${disabled ? styles.statusDisabled : ""}`}
      aria-disabled={disabled}
      aria-label={`${label}${actor ? `, ${actor}` : ""}${disabled ? ", Admin only" : ""}`}
      title={disabled ? "Admin only" : undefined}
    >
      <span className={styles.statusMain}>
        <StatusIcon status={status} />
        {label}
      </span>
      {actor && <span className={styles.statusActor}>{actor}</span>}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: Severity | null }) {
  if (severity === "critical") {
    return (
      <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <path d="M6 1 11 10H1L6 1Z" />
      </svg>
    );
  }
  if (severity === "high") {
    return (
      <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <path d="M6 1.2 10.8 6 6 10.8 1.2 6 6 1.2Z" />
      </svg>
    );
  }
  if (severity === "moderate") {
    return (
      <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="6" r="4.3" />
      </svg>
    );
  }
  if (severity === "low") {
    return (
      <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <path d="M2 3h8v6H2z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="6" r="4.3" fill="none" stroke="currentColor" />
    </svg>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "pending_review") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M8 2.2 14 13H2L8 2.2Z" /><path d="M8 6v3m0 1.7v.1" />
      </svg>
    );
  }
  if (status === "classified") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M2.5 4.5h11v9h-11zM5 2.5v4m6-4v4m-8 1h11" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M2 8.5 6 12l8-8" />
    </svg>
  );
}

function OverrideIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="m6 0 1.5 4.5L12 6 7.5 7.5 6 12 4.5 7.5 0 6l4.5-1.5L6 0Z" />
    </svg>
  );
}
