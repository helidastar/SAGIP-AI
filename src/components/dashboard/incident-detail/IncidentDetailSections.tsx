"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { StaffUser } from "@/components/dashboard/StaffProvider";
import { PRIORITY_WEIGHTS } from "@/lib/constants";
import { WORKFLOW } from "@/lib/workflow";
import type { ReportStatus, Severity } from "@/types";
import styles from "./IncidentDetail.module.css";
import { IncidentPhotoFallback } from "./IncidentDetailStates";

export interface IncidentDetailData {
  id: string;
  trackingCode: string;
  description: string;
  status: ReportStatus;
  incidentType: string | null;
  severity: Severity | null;
  location: { lat: number; lng: number; area: string | null };
  priority: { score: number; band: string; breakdown: Record<string, number>; overridden: boolean } | null;
  teamId: string | null;
  photoUrl: string | null;
  createdAt: string;
  classifications: Classification[];
  review: {
    finalType: string;
    finalSeverity: string;
    notes: string | null;
    reviewer: { full_name: string | null } | null;
    createdAt: string;
  } | null;
  assignments: {
    id: string;
    team: { id: string; name: string } | null;
    assignedBy?: { id: string; full_name: string | null } | null;
    assignedAt: string;
  }[];
  auditLog: {
    id: string;
    action: string;
    actorId: string | null;
    before: unknown;
    after: unknown;
    createdAt: string;
  }[];
}

export interface Classification {
  id: string;
  model: string;
  incidentType: string;
  severity: Severity;
  confidence: number;
  hazards: string[];
  hoaxSuspected?: boolean;
  latencyMs: number | null;
  createdAt: string;
}

export function IncidentDetailShell({
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
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setLastUpdated(formatDate(new Date())),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={styles.detailShell}>
      <aside className={styles.sidebar} aria-label="Operations portal">
        <Link href="/dashboard" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true"><Image src="/brand/sagip-ai-mark.svg" alt="" width={36} height={36} loading="eager" /></span>
          <span className={styles.brandText}>
            <strong>SAGIP-AI</strong>
            <span>Operations portal</span>
          </span>
        </Link>
        <p className={styles.navCaption}>Mission control</p>
        <nav aria-label="Primary">
          <ul className={styles.navList}>
            <li><Link href="/dashboard" className={styles.navLink}><GridIcon />Dashboard</Link></li>
            <li><Link href="/dashboard" className={`${styles.navLink} ${styles.navLinkActive}`} aria-current="page"><ListIcon />Ranked List</Link></li>
            <li><Link href="/dashboard/review" className={styles.navLink}><ReviewIcon />Review Queue</Link></li>
            <li><Link href="/dashboard/analytics" className={styles.navLink}><AnalyticsIcon />Analytics</Link></li>
            <li><span className={styles.navLink}><TeamIcon />Teams</span></li>
            <li><span className={styles.navLink}><HistoryIcon />Audit Log</span></li>
          </ul>
        </nav>
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden="true"><UserIcon /></span>
          <span className={styles.accountCopy}>
            <strong>{staff?.fullName ?? staff?.email ?? "Staff account"}</strong>
            <span>{staff ? `${staff.role} account` : "Authentication"}</span>
          </span>
          <button type="button" className={styles.logoutButton} onClick={onLogout} aria-label="Log out" title="Log out">
            <LogoutIcon />
          </button>
        </div>
      </aside>
      <div className={styles.detailColumn}>
        <header className={styles.topBar}>
          <span className={styles.activePill}><span aria-hidden="true" />EOC active · Level 1</span>
          <span className={styles.lastUpdated}>
            <ClockIcon />
            <span>Last updated: <time suppressHydrationWarning>{lastUpdated || "Synchronizing"}</time></span>
          </span>
          <span className={styles.topSpacer} />
          <span className={styles.topIcon} role="img" aria-label="Notifications"><BellIcon /></span>
          <span className={styles.topIcon} role="img" aria-label="Staff account"><UserIcon /></span>
        </header>
        {error ? (
          <main className={styles.detailMain}>
            <p className={styles.authError} role="alert">{error}</p>
          </main>
        ) : staff ? (
          <main className={styles.detailMain}>{children}</main>
        ) : (
          <main className={styles.detailMain}>
            <p className={styles.authLoading} aria-busy="true">Loading staff session...</p>
          </main>
        )}
      </div>
    </div>
  );
}

export function IncidentHeader({
  detail,
  critical = false,
}: {
  detail: IncidentDetailData;
  critical?: boolean;
}) {
  const statusLabel = detail.status.replaceAll("_", " ");
  return (
    <header className={`${styles.incidentHeader} ${critical ? styles.incidentHeaderCritical : ""}`}>
      <div className={styles.breadcrumbs}>
        <Link href="/dashboard" className={styles.backLink}><BackIcon />Back to ranked list</Link>
        <span className={styles.crumbTrail}>
          Operations Portal <span>/</span> Ranked List <span>/</span> <strong>{detail.trackingCode}</strong>
        </span>
      </div>
      <div className={styles.titleLine}>
        <div className={styles.titleAndStatus}>
          <h1 className={styles.incidentTitle}>{detail.trackingCode}</h1>
          <span className={styles.statusBadge}><StatusIcon status={detail.status} />{statusLabel}</span>
          {critical && <span className={styles.criticalLabel}><SeverityIcon severity="critical" />Critical incident</span>}
        </div>
        <span className={`${styles.priorityTotal} ${detail.severity === "critical" ? styles.priorityTotalCritical : ""}`}>
          <SeverityIcon severity={detail.severity} />
          {detail.priority ? `${detail.priority.band} · ${detail.priority.score}` : "– · —"}
        </span>
      </div>
    </header>
  );
}

export function IncidentOverview({
  detail,
  latest,
  currentTeam,
  photoFailed,
  photoState,
  onPhotoError,
}: {
  detail: IncidentDetailData;
  latest: Classification | undefined;
  currentTeam: { id: string; name: string } | undefined;
  photoFailed: boolean;
  photoState: "normal" | "missing" | "failed";
  onPhotoError: () => void;
}) {
  const showPhoto = detail.photoUrl && !photoFailed && photoState === "normal";
  const photoAlt = `Evidence photo for incident ${detail.trackingCode}: ${detail.description || "No description provided"}`;
  const typeLabel = detail.incidentType?.replaceAll("_", " ") ?? "Type unconfirmed";
  return (
    <section className={styles.overviewCard} aria-label="Incident overview">
      <div className={styles.evidenceColumn}>
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- authorized short-lived signed URL from the staff API
          <img
            src={detail.photoUrl ?? undefined}
            alt={photoAlt}
            className={styles.evidencePhoto}
            onError={onPhotoError}
          />
        ) : (
          <IncidentPhotoFallback
            title={photoState === "failed" || photoFailed ? "Photo unavailable" : "No Citizen Photo Submitted"}
            description={photoState === "failed" || photoFailed ? "The evidence photo could not be loaded." : "Report logged via standard SMS dispatcher portal."}
          />
        )}
        <div className={styles.photoMeta}>
          <span><LockIcon />Evidence visible to authorized staff only</span>
          {showPhoto && <a href={detail.photoUrl ?? undefined} target="_blank" rel="noreferrer">Preview full</a>}
        </div>
      </div>
      <div className={styles.overviewDetails}>
        <div className={styles.locationHeader}>
          <span className={`${styles.priorityCircle} ${detail.priority?.band === "P1" ? styles.priorityCircleCritical : ""}`} aria-label={detail.priority?.band ? `Priority ${detail.priority.band}` : "Priority unconfirmed"}>
            {detail.priority?.band ?? "–"}
          </span>
          <div className={styles.locationCopy}>
            <p className={styles.locationLine}>
              <strong>{detail.trackingCode}</strong>
              <span>·</span>
              <span>{detail.location.area ?? "Unknown area"}</span>
              <span className={styles.coordinates}>{formatCoordinates(detail.location.lat)}, {formatCoordinates(detail.location.lng)}</span>
            </p>
            <a
              className={styles.openMap}
              href={`https://www.openstreetmap.org/?mlat=${detail.location.lat}&mlon=${detail.location.lng}#map=17/${detail.location.lat}/${detail.location.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open map <ExternalLinkIcon />
            </a>
          </div>
        </div>
        <div className={styles.descriptionBox}>
          <span className={styles.descriptionLabel}><QuoteIcon />Citizen description</span>
          <p>{detail.description || <em>No description provided</em>}</p>
        </div>
        <div className={styles.overviewTags}>
          <span className={styles.typeTag}><TypeIcon />{typeLabel}</span>
          <SeverityTag severity={detail.severity} />
          {latest && <span className={styles.confidenceTag}>▦ {Math.round(latest.confidence * 100)}%</span>}
        </div>
        <div className={styles.overviewMeta}>
          <span><ClockIcon />Reported <time dateTime={detail.createdAt}>{formatDate(detail.createdAt)}</time></span>
          <span><TeamIcon />Assigned Team: <strong>{currentTeam?.name ?? "None"}</strong></span>
        </div>
      </div>
    </section>
  );
}

export function WorkflowStepper({
  currentIndex,
}: {
  currentIndex: number;
}) {
  return (
    <ol className={styles.workflow} aria-label="Incident workflow">
      {WORKFLOW.map((step, index) => {
        const complete = index <= currentIndex;
        const current = index === currentIndex;
        return (
          <li key={step.key} className={`${styles.workflowStep} ${complete ? styles.workflowComplete : ""} ${current ? styles.workflowCurrent : ""}`}>
            <span className={styles.workflowLine} aria-hidden="true" />
            <span className={styles.workflowMarker} aria-hidden="true">
              {complete ? <CheckIcon /> : index + 1}
            </span>
            <span className={styles.workflowName}>{index + 1}. {step.label}</span>
            <span className={styles.workflowTime}>{current ? "Current step" : complete ? "Complete" : "Waiting"}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function NextStepPanel({
  title,
  actor,
  explanation,
  children,
}: {
  title: string;
  actor: string;
  explanation: string;
  children?: ReactNode;
}) {
  return (
    <section className={styles.nextStepPanel} aria-labelledby="next-step-title">
      <span className={styles.nextStepIcon} aria-hidden="true"><CheckIcon /></span>
      <div className={styles.nextStepCopy}>
        <h2 id="next-step-title">{title}<span> · {actor}</span></h2>
        <p>{explanation}</p>
      </div>
      {children && <div className={styles.nextStepActions}>{children}</div>}
    </section>
  );
}

export function HumanReviewBanner() {
  return (
    <div className={styles.reviewBanner} role="status">
      <SeverityIcon severity="high" />
      <span><strong>Needs human review</strong> · Confirm or update the AI suggestion before proceeding.</span>
    </div>
  );
}

export function DecisionCards({
  detail,
  latest,
}: {
  detail: IncidentDetailData;
  latest: Classification | undefined;
}) {
  return (
    <div className={styles.decisionGrid}>
      <section className={styles.decisionCard} aria-labelledby="ai-suggested-title">
        <header className={styles.decisionHeading}>
          <h2 id="ai-suggested-title"><AiIcon />AI suggested</h2>
          <span className={styles.sourceBadge}>AI suggestion</span>
        </header>
        {latest ? (
          <>
            <div className={styles.aiValues}>
              <div><span>Predicted type</span><strong>{latest.incidentType.replaceAll("_", " ")}</strong></div>
              <div><span>Estimated severity</span><SeverityTag severity={latest.severity} /></div>
            </div>
            <div className={styles.confidenceBlock}>
              <div className={styles.confidenceLabel}>
                <span>Model confidence score</span>
                <strong>{formatPercent(latest.confidence)}</strong>
              </div>
              <span className={styles.confidenceTrack} role="meter" aria-label="Model confidence" aria-valuenow={latest.confidence * 100} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${Math.min(100, latest.confidence * 100)}%` }} />
              </span>
            </div>
            <div className={styles.hazardsBox}>
              <span>Detected visual hazards</span>
              <strong>{latest.hazards.length ? latest.hazards.join(", ") : "None reported"}</strong>
            </div>
            {latest.hoaxSuspected && (
              <p className={styles.hoaxNotice}>Possible hoax. Check the photo and description before confirming.</p>
            )}
            <p className={styles.modelMeta}>
              <span>Engine: {latest.model}</span>
              <span>Latency: {latest.latencyMs == null ? "—" : `${latest.latencyMs}ms`}</span>
            </p>
          </>
        ) : (
          <p className={styles.emptyValue}>No AI result yet</p>
        )}
      </section>
      <section className={styles.decisionCard} aria-labelledby="human-decision-title">
        <header className={styles.decisionHeading}>
          <h2 id="human-decision-title"><ReviewIcon />Human decision</h2>
          <span className={`${styles.sourceBadge} ${styles.humanBadge}`}>
            {detail.review ? "Reviewed" : "Not reviewed"}
          </span>
        </header>
        {detail.review ? (
          <>
            <div className={styles.humanValues}>
              <span>{detail.review.finalType.replaceAll("_", " ")}</span>
              <SeverityTag severity={detail.review.finalSeverity as Severity} />
            </div>
            {detail.review.notes && <p className={styles.reviewNotes}>{detail.review.notes}</p>}
            <p className={styles.reviewMeta}>
              Reviewer: {detail.review.reviewer?.full_name ?? "Staff"} · {formatDate(detail.review.createdAt)}
            </p>
          </>
        ) : detail.status === "pending_review" ? (
          <p className={styles.humanMessage}>Waiting for staff review.</p>
        ) : detail.status === "received" ? (
          <p className={styles.humanMessage}>Not needed yet.</p>
        ) : (
          <p className={styles.humanMessage}>Not needed: the AI was confident and rated it low/moderate, so its answer was used directly.</p>
        )}
        <p className={styles.decisionFooter}>
          Reviewer: {detail.review?.reviewer?.full_name ?? (detail.review ? "Staff" : "System Automatic Filter")}
          <span>Status: {detail.review ? "Finalized" : detail.status.replaceAll("_", " ")}</span>
        </p>
      </section>
    </div>
  );
}

const SCORE_FACTORS: { key: keyof typeof PRIORITY_WEIGHTS; label: string }[] = [
  { key: "severity", label: "Severity factor" },
  { key: "population", label: "Population density affected" },
  { key: "locationRisk", label: "Location susceptibility" },
  { key: "type", label: "Hazard incident type" },
];

export function PriorityBreakdown({ detail }: { detail: IncidentDetailData }) {
  return (
    <section className={styles.sectionCard} aria-labelledby="priority-breakdown-title">
      <header className={styles.sectionHeading}>
        <h2 id="priority-breakdown-title">Priority score · total {detail.priority?.score ?? "—"} / 100</h2>
        <span className={styles.sectionBadge}>Weighted multi-factor</span>
      </header>
      {!detail.priority ? (
        <p className={styles.emptyValue}>Priority score not available.</p>
      ) : (
        <div className={styles.scoreGrid}>
          {SCORE_FACTORS.map(({ key, label }) => {
            const value = detail.priority?.breakdown?.[key];
            const max = PRIORITY_WEIGHTS[key] * 100;
            const width = value === undefined ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
            return (
              <div className={styles.scoreFactor} key={key}>
                <div className={styles.scoreFactorHeading}>
                  <strong>{label}</strong>
                  <span>{value === undefined ? `— / ${formatScore(max)}` : `${formatScore(value)} / ${formatScore(max)}`}</span>
                </div>
                <span className={styles.scoreTrack} role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
                  <span style={{ width: `${width}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      )}
      {detail.status === "pending_review" && (
        <p className={styles.draftNote}>Draft score from the AI suggestion; it is rescored when confirmed.</p>
      )}
    </section>
  );
}

export function AdminTools({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <details
      className={styles.adminTools}
      open={open}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        if (nextOpen !== open) setOpen(nextOpen);
      }}
    >
      <summary aria-expanded={open}>
        <span className={styles.disclosureIcon} aria-hidden="true"><ChevronIcon /></span>
        <strong>Admin tools</strong>
        <span className={styles.sectionBadge}>{disabled ? "Role: field responder · locked" : "Authorized: admin"}</span>
      </summary>
      <div className={styles.adminToolsBody}>{children}</div>
    </details>
  );
}

export function AdminActionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.adminActionCard}>
      <h3>{icon}{title}</h3>
      <p>{description}</p>
      {children}
    </section>
  );
}

export function AssignmentHistory({ detail }: { detail: IncidentDetailData }) {
  return (
    <DetailSection title="Assignment history" count={`${detail.assignments.length} ${detail.assignments.length === 1 ? "event" : "events"}`}>
      {detail.assignments.length ? (
        <ul className={styles.assignmentList}>
          {detail.assignments.map((assignment) => (
            <li key={assignment.id}>
              <span className={styles.assignmentIcon} aria-hidden="true"><TeamIcon /></span>
              <span className={styles.assignmentCopy}>
                <strong>{assignment.team?.name ?? "Unknown team"}</strong>
                <span>{assignment.assignedBy?.full_name ? `Unit deployed by ${assignment.assignedBy.full_name}` : "Team assignment recorded"}</span>
              </span>
              <time dateTime={assignment.assignedAt}>{formatDate(assignment.assignedAt)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyValue}>No team assigned yet.</p>
      )}
    </DetailSection>
  );
}

export function ClassificationsTable({ detail }: { detail: IncidentDetailData }) {
  return (
    <DetailSection title={`AI classifications (${detail.classifications.length})`} count="Model pipeline logs">
      <div className={styles.tableScroller} tabIndex={0} role="region" aria-label="AI classifications table">
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th scope="col">When</th><th scope="col">Model / step</th><th scope="col">Type</th>
              <th scope="col">Severity</th><th scope="col">Conf</th><th scope="col">Hazards</th>
            </tr>
          </thead>
          <tbody>
            {detail.classifications.length ? detail.classifications.map((classification) => (
              <tr key={classification.id}>
                <td><time dateTime={classification.createdAt}>{formatDate(classification.createdAt)}</time></td>
                <td>{classification.model}</td>
                <td>{classification.incidentType.replaceAll("_", " ")}</td>
                <td><SeverityTag severity={classification.severity} /></td>
                <td>{formatPercent(classification.confidence)}</td>
                <td>{classification.hazards.join(", ") || "—"}</td>
              </tr>
            )) : (
              <tr><td className={styles.tableEmpty} colSpan={6}>No AI classifications recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </DetailSection>
  );
}

export function AuditLog({ detail }: { detail: IncidentDetailData }) {
  return (
    <DetailSection title={`Audit log (${detail.auditLog.length})`} count="Cryptographic verification">
      {detail.auditLog.length ? (
        <ul className={styles.auditList}>
          {detail.auditLog.map((event) => <AuditEvent key={event.id} event={event} />)}
        </ul>
      ) : (
        <p className={styles.emptyValue}>No audit events recorded.</p>
      )}
    </DetailSection>
  );
}

function AuditEvent({ event }: { event: IncidentDetailData["auditLog"][number] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li>
      <details
        className={styles.auditEvent}
        open={expanded}
        onToggle={(toggleEvent) => {
          const nextOpen = toggleEvent.currentTarget.open;
          if (nextOpen !== expanded) setExpanded(nextOpen);
        }}
      >
        <summary aria-expanded={expanded}>
          <span className={styles.disclosureIcon} aria-hidden="true"><ChevronIcon /></span>
          <AuditIcon action={event.action} />
          <strong>{event.action}</strong>
          <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
        </summary>
        <div className={styles.auditDetails}>
          <strong>Raw action: <code>{event.action}</code></strong>
          <pre>{JSON.stringify({ before: event.before, after: event.after, actorId: event.actorId }, null, 2)}</pre>
        </div>
      </details>
    </li>
  );
}

export function DetailSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: ReactNode;
}) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className={styles.sectionCard} aria-labelledby={id}>
      <header className={styles.sectionHeading}>
        <h2 id={id}>{title}</h2>
        {count && <span className={styles.sectionBadge}>{count}</span>}
      </header>
      {children}
    </section>
  );
}

export function SeverityTag({ severity }: { severity: Severity | null }) {
  const label = severity ? titleCase(severity) : "Severity unconfirmed";
  const className = severity === "critical"
    ? styles.severityCritical
    : severity === "high"
      ? styles.severityHigh
      : severity === "moderate"
        ? styles.severityModerate
        : severity === "low"
          ? styles.severityLow
          : styles.severityUnknown;
  return (
    <span className={`${styles.severityTag} ${className}`} aria-label={label}>
      <SeverityIcon severity={severity} />{label}
    </span>
  );
}

function AuditIcon({ action }: { action: string }) {
  if (action.includes("team") || action.includes("assign")) return <TeamIcon />;
  if (action.includes("report") || action.includes("classif")) return <AiIcon />;
  return <StatusIcon status={action} />;
}

function formatCoordinates(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatScore(value: number) {
  return Number.isInteger(value) ? `${value}.0` : value.toFixed(1);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusIcon({ status }: { status: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {status === "pending_review"
        ? <><path d="M8 2 14 13H2L8 2Z" /><path d="M8 6v3m0 1.5v.1" /></>
        : <path d="M2 8.5 6 12l8-8" />}
    </svg>
  );
}

function SeverityIcon({ severity }: { severity: Severity | null }) {
  if (severity === "critical") return <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 1 11 10H1L6 1Z" /></svg>;
  if (severity === "high") return <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 1 11 6 6 11 1 6 6 1Z" /></svg>;
  if (severity === "low") return <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2 3h8v6H2z" /></svg>;
  return <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><circle cx="6" cy="6" r="4" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 8.5 3 3L13 5" /></svg>;
}

function BackIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M13 8H3m0 0 4-4m-4 4 4 4" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>;
}

function QuoteIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 4h4v4H4v3H2V7a3 3 0 0 1 1-3Zm7 0h4v4h-3v3H9V7a3 3 0 0 1 1-3Z" /></svg>;
}

function TypeIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 4h12M8 4v9m-3 0h6M5 7h6" /></svg>;
}

function ExternalLinkIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 3h4v4m0-4L7 9" /><path d="M12 9v4H3V4h4" /></svg>;
}

function AiIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M8 2a4 4 0 0 0-2 7.5V12h4V9.5A4 4 0 0 0 8 2Zm-2 12h4" /><path d="M8 0v1m6 2-1 .6M2 3l1 .6" /></svg>;
}

function GridIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" /><rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" /></svg>;
}

function ListIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M5 3h9M5 8h9M5 13h9" /><circle cx="2" cy="3" r=".7" fill="currentColor" /><circle cx="2" cy="8" r=".7" fill="currentColor" /><circle cx="2" cy="13" r=".7" fill="currentColor" /></svg>;
}

function ReviewIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2 3h12v10H2zM5 1v4m6-4v4M4 8h8m-8 2.5h5" /></svg>;
}

function AnalyticsIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="2" width="12" height="12" /><path d="M5 11V8m3 3V5m3 6V7" /></svg>;
}

function TeamIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="6" cy="5" r="2" /><circle cx="11.5" cy="6" r="1.5" /><path d="M2 13c.3-2.2 1.5-3.5 4-3.5s3.7 1.3 4 3.5m.5-3.2c2.1-.1 3.3 1 3.5 3.2" /></svg>;
}

function HistoryIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2 6a6 6 0 1 1-.2 4M2 2v4h4m2-1v3l2 1" /></svg>;
}

function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20c.7-3.5 3-5.2 7-5.2s6.3 1.7 7 5.2" /></svg>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" /><circle cx="19" cy="5" r="2" fill="currentColor" /></svg>;
}

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M10 4H5v16h5m5-4 4-4-4-4m4 4H9" /></svg>;
}

function ChevronIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>;
}

