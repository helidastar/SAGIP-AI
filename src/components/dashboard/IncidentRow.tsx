import Link from "next/link";
import { stepFor } from "@/lib/workflow";
import type { Severity } from "@/types";

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

export function IncidentRow({
  incident,
  index,
}: {
  incident: DashboardIncident;
  index: number;
}) {
  const step = stepFor(incident.status);
  const nextAction =
    step?.key === "review"
      ? "Needs review"
      : step?.key === "assign"
        ? "Assign a team"
        : step?.key === "respond"
          ? "Team responding"
          : step?.next ?? incident.status.replaceAll("_", " ");

  return (
    <li className="dashboard-incident-row">
      <Link
        href={`/dashboard/incidents/${incident.id}`}
        className="dashboard-incident-link"
      >
        <span className={`dashboard-priority-orb priority-${incident.priority?.band ?? "none"}`}>
          <span className="sr-only">Priority </span>
          {incident.priority?.band ?? "—"}
        </span>
        <span className="dashboard-incident-copy">
          <span className="dashboard-incident-heading">
            <span className="dashboard-incident-type">
              {incident.incidentType?.replaceAll("_", " ") ?? "Unconfirmed"}
            </span>
            {incident.severity && <SeverityTag severity={incident.severity} />}
            <span className="dashboard-tracking-code">{incident.trackingCode}</span>
          </span>
          <span className="dashboard-incident-description">
            {incident.description || "No description provided"}
          </span>
          <span className="dashboard-incident-meta">
            <span className="dashboard-location">
              <PinIcon />
              {incident.location.area ?? "Unknown area"}
            </span>
            <span aria-hidden="true" className="dashboard-meta-separator">•</span>
            <time dateTime={incident.createdAt}>{new Date(incident.createdAt).toLocaleString()}</time>
          </span>
        </span>
        <span className="dashboard-incident-trailing">
          {incident.priority && (
            <span className="dashboard-score" aria-label={`Priority score ${incident.priority.score}`}>
              {incident.priority.score.toFixed(1)}
            </span>
          )}
          {incident.priority?.overridden && <span className="dashboard-override">Override</span>}
          {incident.status === "pending_review" && (
            <span className="dashboard-review-flag">
              <ReviewIcon />
              Review
            </span>
          )}
          <StatusAction status={incident.status} label={nextAction} index={index} />
        </span>
      </Link>
    </li>
  );
}

function SeverityTag({ severity }: { severity: Severity }) {
  return (
    <span className={`dashboard-severity-tag severity-${severity}`}>
      <SeverityIcon severity={severity} />
      {severity}
    </span>
  );
}

function StatusAction({ status, label, index }: { status: string; label: string; index: number }) {
  const step = stepFor(status);
  const actionClass = step?.key === "review" || step?.key === "assign"
    ? "status-action-needed"
    : step?.key === "respond"
      ? "status-action-responding"
      : "status-action-neutral";
  return (
    <span className={`dashboard-status-action ${actionClass}`}>
      <StatusIcon status={status} />
      {label}
      <span className="sr-only">, incident ranked {index + 1}</span>
    </span>
  );
}

function SeverityIcon({ severity }: { severity: Severity }) {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      {severity === "critical" ? (
        <path d="M6 1 11 10H1L6 1Z" />
      ) : severity === "high" ? (
        <path d="M6 1.2 10.8 6 6 10.8 1.2 6 6 1.2Z" />
      ) : severity === "moderate" ? (
        <circle cx="6" cy="6" r="4.3" />
      ) : (
        <path d="M2 3h8v6H2z" />
      )}
    </svg>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "pending_review") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M8 2.2 14 13H2L8 2.2Z" />
        <path d="M8 6v3m0 1.7v.1" />
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

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 14s4.5-4.1 4.5-8A4.5 4.5 0 0 0 3.5 6c0 3.9 4.5 8 4.5 8Z" />
      <circle cx="8" cy="6" r="1.5" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 2.5h10v11H3zM5.5 5.5h5m-5 3h5" />
    </svg>
  );
}
