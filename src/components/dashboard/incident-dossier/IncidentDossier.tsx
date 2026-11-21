"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ReviewForm } from "@/components/dashboard/ReviewQueue";
import type { StaffUser } from "@/components/dashboard/StaffProvider";
import { api } from "@/lib/api-client";
import type {
  Classification,
  IncidentDetailData,
} from "@/components/dashboard/incident-detail/IncidentDetailSections";
import { checkFirstReasons } from "@/lib/ai/review";
import {
  CONFIDENCE_THRESHOLD,
  INCIDENT_TYPES,
  PRIORITY_WEIGHTS,
  REPORT_STATUSES,
  STATUS_TRANSITIONS,
} from "@/lib/constants";
import {
  ASSIGNABLE_STATUSES,
  stepFor,
  TRANSITION_LABELS,
} from "@/lib/workflow";
import type { ReportStatus, Severity } from "@/types";
import { severityWithPercent } from "@/lib/severity-label";
import styles from "./IncidentDossier.module.css";

type DossierClassification = Classification & {
  severityConfidence?: number | null;
};

export type DossierIncidentDetail = Omit<IncidentDetailData, "classifications"> & {
  classifications: DossierClassification[];
  updatedAt?: string;
};

export interface IncidentAction {
  label: string;
  path: string;
  method: string;
  json?: unknown;
}

interface IncidentDossierShellProps {
  staff: StaffUser | null;
  error: string | null;
  onLogout: () => void;
  children: ReactNode;
}

export function IncidentDossierShell({
  staff,
  error,
  onLogout,
  children,
}: IncidentDossierShellProps) {
  const staffName = staff?.fullName ?? staff?.email ?? "Staff account";
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [reviewCountError, setReviewCountError] = useState<string | null>(null);

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    void api<{ items: unknown[] }>("/api/review-queue").then((response) => {
      if (cancelled) return;
      if (response.ok) setReviewCount(response.data.items.length);
      else setReviewCountError(response.error ?? "Could not load review queue count.");
    });
    return () => {
      cancelled = true;
    };
  }, [staff]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Operations portal">
        <Link href="/dashboard" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true"><Image src="/brand/sagip-ai-mark.svg" alt="" width={36} height={36} loading="eager" /></span>
          <span className={styles.brandCopy}>
            <strong>SAGIP-AI</strong>
            <span>Ops portal</span>
          </span>
        </Link>
        <p className={styles.navHeading}>EOC Navigation</p>
        <nav aria-label="Primary">
          <ul className={styles.navList}>
            <li>
              <Link href="/dashboard" className={`${styles.navLink} ${styles.navLinkActive}`} aria-current="page">
                <ListIcon /><span>Ranked List</span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/review" className={styles.navLink}>
                <ReviewIcon /><span>Review Queue</span>
                {reviewCount !== null && <span className={styles.navBadge} aria-label={`${reviewCount} items in review queue`}>{reviewCount}</span>}
              </Link>
            </li>
            <li>
              <Link href="/dashboard/analytics" className={styles.navLink}>
                <AnalyticsIcon /><span>Analytics</span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/definitions" className={styles.navLink}>
                <BookIcon /><span>Definitions</span>
              </Link>
            </li>
          </ul>
        </nav>
        {reviewCountError && <p className={styles.queueError} role="alert">{reviewCountError}</p>}
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden="true"><UserIcon /></span>
          <span className={styles.accountCopy}>
            <strong>{staffName}</strong>
            <span>{staff?.role ?? "Staff role unavailable"}</span>
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
        {error ? (
          <main className={styles.shellMessage} role="alert">{error}</main>
        ) : staff ? (
          children
        ) : (
          <main className={styles.shellMessage} aria-busy="true">Loading staff session...</main>
        )}
      </div>
    </div>
  );
}

export function IncidentDossierView({
  state,
  stateMessage,
  detail,
  staff,
  teams,
  teamsError,
  lastRefreshed,
  busy,
  error,
  message,
  onAction,
  onReviewDone,
  onRetry,
  photoFailed,
  onPhotoError,
}: {
  state: "loading" | "ready" | "notFound" | "error";
  stateMessage?: string;
  detail: DossierIncidentDetail | null;
  staff: StaffUser | null;
  teams: { id: string; name: string }[];
  teamsError: string | null;
  lastRefreshed: string | null;
  busy: boolean;
  error: string | null;
  message: string | null;
  onAction: (action: IncidentAction) => Promise<boolean>;
  onReviewDone: () => void;
  onRetry: () => void;
  photoFailed: boolean;
  onPhotoError: () => void;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [score, setScore] = useState("");
  const [reason, setReason] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(true);

  if (state !== "ready" || !detail) {
    const title = state === "notFound"
      ? "Incident not found"
      : state === "error"
        ? "Unable to load incident"
        : "Loading incident";
    return (
      <main className={styles.content}>
        <TopBar staff={staff} lastRefreshed={lastRefreshed} />
        <section className={state === "loading" ? styles.loadingCard : styles.stateCard} role={state === "error" || state === "notFound" ? "alert" : undefined} aria-busy={state === "loading"}>
          {state === "loading" ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              <h1>{title}</h1>
            </>
          ) : (
            <>
              <h1>{title}</h1>
              <p>{state === "notFound" ? "This incident may have been removed or is no longer available." : stateMessage}</p>
              <button type="button" className={styles.buttonPrimary} onClick={onRetry}>Retry</button>
            </>
          )}
        </section>
      </main>
    );
  }

  const latest = detail.classifications[0];
  const incident = detail;
  const demoData = isDemoData(detail);
  const currentTeam = teams.find((team) => team.id === detail.teamId);
  const isAdmin = staff?.role === "admin";
  const onTeam = Boolean(detail.teamId && detail.teamId === staff?.teamId);
  const step = stepFor(detail.status);
  const transitions = (STATUS_TRANSITIONS[detail.status] ?? [])
    .filter((status) => status !== "rejected");
  const canReject = (STATUS_TRANSITIONS[detail.status] ?? []).includes("rejected");
  const canAssign = ASSIGNABLE_STATUSES.includes(detail.status);
  const incidentType = latest && INCIDENT_TYPES.find((value) => value === latest.incidentType);
  const reviewReasons = latest && incidentType
    ? checkFirstReasons({
        incidentType,
        confidence: latest.confidence,
        severity: latest.severity,
        severityConfidence: latest.severityConfidence ?? null,
        hazards: latest.hazards,
        hoaxSuspected: latest.hoaxSuspected ?? false,
      })
    : [];
  // Once staff confirm the type and severity, the AI's check-first flags no longer apply.
  const needsReview = detail.status === "pending_review" || detail.status === "received";
  const isCurrentStepReview = step?.key === "review";
  const stepTitle = detail.status === "rejected"
    ? "Incident rejected"
    : `Next step: ${step?.next ?? titleCase(detail.status)}`;
  const stepExplanation = detail.status === "rejected"
    ? "This report was marked as not a real incident. No further action."
    : step?.explain ?? "No further workflow action is available.";

  async function assignTeam(label: string) {
    const team = teams.find((item) => item.id === selectedTeamId);
    if (!selectedTeamId || !window.confirm(`Confirm ${label.toLowerCase()}${team ? ` to ${team.name}` : ""}?`)) return;
    const saved = await onAction({
      label,
      path: `/api/incidents/${incident.id}/assign`,
      method: "POST",
      json: { teamId: selectedTeamId },
    });
    if (saved) setSelectedTeamId("");
  }

  async function saveOverride() {
    if (!window.confirm("Confirm this priority score override?")) return;
    const saved = await onAction({
      label: "Priority override",
      path: `/api/incidents/${incident.id}/priority`,
      method: "PATCH",
      json: { score: Number(score), reason },
    });
    if (saved) {
      setOverrideOpen(false);
      setScore("");
      setReason("");
    }
  }

  function assignmentForm(label: string) {
    return (
      <div className={styles.formRow}>
        <label className={styles.field}>
          <span>Team</span>
          <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} disabled={busy}>
            <option value="">Choose team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id} disabled={team.id === incident.teamId}>
                {team.name}{team.id === incident.teamId ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.buttonPrimary} disabled={busy || !selectedTeamId} onClick={() => void assignTeam(label)}>
          <TeamIcon />{label}
        </button>
      </div>
    );
  }

  function transitionAction(status: ReportStatus) {
    const label = incident.status === "resolved" && status === "in_progress"
      ? "Reopen"
      : TRANSITION_LABELS[status] ?? status;
    return (
      <button
        type="button"
        key={status}
        className={status === "resolved" || status === "in_progress" ? styles.buttonPrimary : styles.buttonSecondary}
        disabled={busy || (!isAdmin && !onTeam)}
        onClick={() => void onAction({
          label,
          path: `/api/incidents/${incident.id}/status`,
          method: "PATCH",
          json: { status },
        })}
        title={!isAdmin && !onTeam ? "Only the assigned team or an admin can update this." : undefined}
      >
        {label === "Reopen" ? <ReopenIcon /> : <CheckIcon />}
        {label}
      </button>
    );
  }

  return (
    <main className={styles.content}>
      <TopBar staff={staff} lastRefreshed={lastRefreshed} />
      <div className={styles.page}>
        <section className={`${styles.hero} ${detail.priority?.band === "P1" ? styles.heroCritical : ""}`}>
          <div className={styles.breadcrumbs}>
            <span>Dashboard</span>
            <span aria-hidden="true">/</span>
            <Link href="/dashboard">Ranked List</Link>
            <span aria-hidden="true">/</span>
            <strong>{detail.trackingCode}</strong>
          </div>
          <div className={styles.titleRow}>
            <div className={styles.titleGroup}>
              <h1>Incident Dossier: {detail.trackingCode}</h1>
              <span className={`${styles.priorityBadge} ${detail.priority?.band === "P1" ? styles.priorityCritical : ""}`}>
                {detail.priority?.band ?? "Priority unavailable"}
              </span>
              <span className={`${styles.statusBadge} ${detail.status === "pending_review" ? styles.statusReview : ""}`}>
                {titleCase(detail.status)}
              </span>
              {demoData && <span className={styles.demoBadge}>Demo data</span>}
            </div>
          </div>
          <div className={styles.metaRow}>
            {detail.location.area && <span>{detail.location.area}</span>}
            <span className={styles.coordinates}>{formatCoordinates(detail.location.lat)}, {formatCoordinates(detail.location.lng)}</span>
            <a href={openMapUrl(detail.location.lat, detail.location.lng)} target="_blank" rel="noreferrer">
              Open map <ExternalLinkIcon />
            </a>
            <span>Reported <time dateTime={detail.createdAt}>{formatDate(detail.createdAt)}</time></span>
            <span>Assigned team <strong>{currentTeam?.name ?? (detail.teamId ? "Team unavailable" : "None")}</strong></span>
          </div>
          <div className={`${styles.compositePanel} ${latest?.hazards.length ? "" : styles.compositePanelSingle}`}>
            <div className={styles.compositeScore}>
              <span className={styles.overline}>Composite score</span>
              <strong>{detail.priority ? formatScore(detail.priority.score) : "Not scored"}<small>{detail.priority ? " / 100" : ""}</small></strong>
            </div>
            {latest?.hazards.length ? (
              <div className={styles.hazardState}>
                <span className={styles.overline}>Active hazard state</span>
                <strong>{latest.hazards.join(", ")}</strong>
              </div>
            ) : null}
          </div>
          {needsReview && (
            <ReviewBanner
              latest={latest}
              reasons={reviewReasons}
              pending={detail.status === "pending_review"}
            />
          )}
          <section className={styles.lifecycle} aria-label="Operational workflow lifecycle">
            <h2 className={styles.overline}>Operational workflow lifecycle</h2>
            <StatusTimeline detail={detail} />
            <div className={styles.nextStep}>
              <div className={styles.nextStepCopy}>
                <span className={styles.overline}>Next step</span>
                <h3>{stepTitle}</h3>
                <p>{stepExplanation}</p>
              </div>
              <div className={styles.nextStepActions}>
                {isCurrentStepReview && (
                  <a className={styles.buttonPrimary} href="#human-verification">Review incident</a>
                )}
                {step?.key === "assign" && (
                  isAdmin
                    ? assignmentForm("Assign team")
                    : <span className={styles.mutedMessage}>Waiting for an admin to assign a team.</span>
                )}
                {(step?.key === "respond" || step?.key === "done") && transitions.map(transitionAction)}
                {step?.key === "respond" && !isAdmin && !onTeam && (
                  <span className={styles.mutedMessage}>Only {currentTeam?.name ?? "the assigned team"} or an admin can update this incident.</span>
                )}
              </div>
            </div>
          </section>
          {(error || message) && (
            <p className={error ? styles.actionError : styles.actionMessage} role={error ? "alert" : "status"}>
              {error ?? message}
            </p>
          )}
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.primaryColumn}>
            <section className={styles.card} aria-labelledby="evidence-title">
              <CardHeading icon={<PhotoIcon />} title="Field Photographic Evidence" id="evidence-title" />
              {detail.photoUrl && !photoFailed ? (
                <div className={styles.photoFrame}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed evidence URL returned by the staff API */}
                  <img
                    src={detail.photoUrl}
                    alt={`Evidence photo for ${detail.trackingCode}: ${detail.description || "incident report"}`}
                    onError={onPhotoError}
                  />
                </div>
              ) : (
                <div className={styles.photoFallback} role="status">
                  <PhotoIcon />
                  <strong>{photoFailed ? "Photo unavailable" : "No photo available"}</strong>
                </div>
              )}
              {detail.photoUrl && !photoFailed && (
                <a className={styles.textLink} href={detail.photoUrl} target="_blank" rel="noreferrer">Open original photo <ExternalLinkIcon /></a>
              )}
              <p className={styles.captureTime}>
                Reported <time dateTime={detail.createdAt}>{formatDate(detail.createdAt)}</time>
              </p>
              <div className={styles.transcript}>
                <h3><TranscriptIcon />Citizen transcript</h3>
                {detail.description
                  ? <p>{detail.description}</p>
                  : <p className={styles.emptyText}>No description recorded.</p>}
              </div>
            </section>

            <section className={styles.card} aria-labelledby="geospatial-title">
              <CardHeading icon={<MapIcon />} title="Geospatial context" id="geospatial-title" />
              <p className={styles.geoCoordinates}>
                {formatCoordinates(detail.location.lat)}, {formatCoordinates(detail.location.lng)}
              </p>
              {detail.location.area && <p className={styles.geoArea}>{detail.location.area}</p>}
              <a className={styles.buttonSecondary} href={openMapUrl(detail.location.lat, detail.location.lng)} target="_blank" rel="noreferrer">
                Open map <ExternalLinkIcon />
              </a>
            </section>

            <section className={styles.card} aria-labelledby="audit-title">
              <CardHeading icon={<HistoryIcon />} title="Audit trail" id="audit-title" />
              {detail.auditLog.length ? (
                <ol className={styles.auditList}>
                  {detail.auditLog.map((event) => (
                    <li key={event.id}>
                      <details className={styles.auditEvent}>
                        <summary>
                          <span className={styles.auditDot} aria-hidden="true" />
                          <strong>{auditLabel(event.action)}</strong>
                          <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                        </summary>
                        <pre>{JSON.stringify({ before: event.before, after: event.after, actorId: event.actorId }, null, 2)}</pre>
                      </details>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.emptyText}>No audit events recorded.</p>
              )}
            </section>
          </div>

          <div className={styles.secondaryColumn}>
            <section className={styles.card} aria-labelledby="ai-title">
              <CardHeading icon={<AiIcon />} title="AI Assessment" id="ai-title">
                <span className={styles.aiLabel}>AI-generated</span>
              </CardHeading>
              {latest ? (
                <>
                  <div className={styles.aiModel}>
                    <span className={styles.overline}>Model / step</span>
                    <strong>{latest.model}</strong>
                  </div>
                  <DataPair label="Predicted type" value={titleCase(latest.incidentType)} />
                  <DataPair label="Estimated severity" value={severityWithPercent(latest.severity, latest.severityConfidence)} />
                  <div className={styles.confidenceBlock}>
                    <div className={styles.dataLabel}>
                      <span>Confidence</span><strong>{formatPercent(latest.confidence)}</strong>
                    </div>
                    <span className={styles.confidenceTrack} role="meter" aria-label="AI confidence" aria-valuenow={latest.confidence * 100} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${Math.min(100, Math.max(0, latest.confidence * 100))}%` }} />
                    </span>
                  </div>
                  <div className={styles.hazards}>
                    <span className={styles.overline}>Hazards</span>
                    {latest.hazards.length
                      ? <ul>{latest.hazards.map((hazard, index) => <li key={`${hazard}-${index}`}>{hazard}</li>)}</ul>
                      : <p className={styles.emptyText}>No hazards recorded.</p>}
                  </div>
                </>
              ) : (
                <p className={styles.emptyText}>No AI result yet</p>
              )}
              <details className={styles.historyDisclosure}>
                <summary>AI classifications history ({detail.classifications.length})</summary>
                {detail.classifications.length ? (
                  <div className={styles.tableScroller}>
                    <table>
                      <thead><tr><th>When</th><th>Model / Step</th><th>Type</th><th>Severity</th><th>Conf</th><th>Hazards</th></tr></thead>
                      <tbody>
                        {detail.classifications.map((classification) => (
                          <tr key={classification.id}>
                            <td><time dateTime={classification.createdAt}>{formatDate(classification.createdAt)}</time></td>
                            <td>{classification.model}</td>
                            <td>{titleCase(classification.incidentType)}</td>
                            <td>{severityWithPercent(classification.severity, classification.severityConfidence)}</td>
                            <td>{formatPercent(classification.confidence)}</td>
                            <td>{classification.hazards.join(", ") || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className={styles.emptyText}>No AI classifications recorded.</p>}
              </details>
            </section>

            <PriorityBreakdown detail={detail} />

            <section className={styles.card} id="human-verification" aria-labelledby="verification-title">
              <CardHeading icon={<VerificationIcon />} title="Human Verification Console" id="verification-title">
                {staff?.role && <span className={styles.roleBadge}>{titleCase(staff.role)}</span>}
              </CardHeading>
              <div className={styles.staffIdentity}>
                <UserIcon />
                <span><strong>{staff?.fullName ?? staff?.email ?? "Staff account"}</strong><small>{staff?.role ?? "Role unavailable"}</small></span>
              </div>
              <div className={styles.reviewValues}>
                <div>
                  <span className={styles.overline}>AI proposed</span>
                  {latest
                    ? <strong>{titleCase(latest.incidentType)} · {severityWithPercent(latest.severity, latest.severityConfidence)}</strong>
                    : <strong>No AI result yet</strong>}
                </div>
                <div>
                  <span className={styles.overline}>Human confirmed</span>
                  {detail.review ? (
                    <strong>{titleCase(detail.review.finalType)} · {titleCase(detail.review.finalSeverity)}</strong>
                  ) : detail.incidentType || detail.severity ? (
                    <strong>{detail.incidentType ? titleCase(detail.incidentType) : "Type not confirmed"} · {detail.severity ? titleCase(detail.severity) : "Severity not confirmed"}</strong>
                  ) : <strong>Not confirmed</strong>}
                </div>
              </div>
              {detail.review?.notes && (
                <div className={styles.reviewerNotes}>
                  <span className={styles.overline}>Reviewer notes</span>
                  <p>{detail.review.notes}</p>
                </div>
              )}
              {detail.review && (
                <p className={styles.reviewMeta}>
                  Reviewed by {detail.review.reviewer?.full_name ?? "Staff"} · {formatDate(detail.review.createdAt)}
                </p>
              )}
              {isCurrentStepReview && (
                <div className={styles.reviewForm}>
                  <ReviewForm
                    bare
                    item={{
                      id: detail.id,
                      description: detail.description,
                      photoUrl: detail.photoUrl,
                      classification: latest ?? null,
                    }}
                    onDone={onReviewDone}
                  />
                </div>
              )}
            </section>

            <section className={styles.card} aria-labelledby="assignment-title">
              <CardHeading icon={<TeamIcon />} title="Tactical Field Assignment" id="assignment-title" />
              <div className={styles.currentAssignment}>
                <span className={styles.overline}>Assigned team</span>
                <strong>{currentTeam?.name ?? (detail.teamId ? "Team unavailable" : "None")}</strong>
              </div>
              {teamsError && <p className={styles.actionError} role="alert">Teams could not be loaded: {teamsError}</p>}
              <h3 className={styles.subheading}>Assignment history</h3>
              {detail.assignments.length ? (
                <ul className={styles.assignmentList}>
                  {detail.assignments.map((assignment) => (
                    <li key={assignment.id}>
                      <strong>{assignment.team?.name ?? "Team unavailable"}</strong>
                      {assignment.assignedBy?.full_name && <span>Assigned by {assignment.assignedBy.full_name}</span>}
                      <time dateTime={assignment.assignedAt}>{formatDate(assignment.assignedAt)}</time>
                    </li>
                  ))}
                </ul>
              ) : <p className={styles.emptyText}>No assignment history recorded.</p>}
            </section>

            {isAdmin ? (
              <details
                className={styles.adminTools}
                open={adminToolsOpen}
                onToggle={(event) => {
                  if (event.currentTarget.open !== adminToolsOpen) setAdminToolsOpen(event.currentTarget.open);
                }}
              >
                <summary><strong>Admin tools</strong><span>{adminToolsOpen ? "Hide" : "Show"}</span></summary>
                <div className={styles.adminToolsBody}>
                  {canAssign && detail.status !== "classified" && (
                    <section className={styles.adminAction}>
                      <h3>Reassign team</h3>
                      {assignmentForm("Reassign team")}
                    </section>
                  )}
                  <section className={styles.adminAction}>
                    <h3>Priority score manual override</h3>
                    {overrideOpen ? (
                      <div className={styles.adminForm}>
                        <label className={styles.field}>
                          <span>Score (0–100)</span>
                          <input value={score} onChange={(event) => setScore(event.target.value)} inputMode="decimal" />
                        </label>
                        <label className={styles.field}>
                          <span>Reason</span>
                          <input value={reason} onChange={(event) => setReason(event.target.value)} />
                        </label>
                        <div className={styles.formActions}>
                          <button
                            type="button"
                            className={styles.buttonPrimary}
                            disabled={busy || !score || !reason}
                            onClick={() => void saveOverride()}
                          >
                            Save override
                          </button>
                          <button type="button" className={styles.buttonSecondary} onClick={() => setOverrideOpen(false)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className={styles.buttonSecondary} onClick={() => setOverrideOpen(true)}>
                        Override score
                      </button>
                    )}
                  </section>
                  <section className={styles.adminAction}>
                    <h3>AI pipeline re-evaluation</h3>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Run the AI again on this report? Its draft type and severity may change.")) void onAction({ label: "Re-run AI", path: `/api/incidents/${detail.id}/reclassify`, method: "POST" });
                      }}
                    >
                      Re-run AI
                    </button>
                    {canReject && (
                      <button
                        type="button"
                        className={styles.buttonDanger}
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Reject ${detail.trackingCode}? It will be marked as not a real incident.`)) void onAction({ label: "Reject incident", path: `/api/incidents/${detail.id}/status`, method: "PATCH", json: { status: "rejected" } });
                        }}
                      >
                        Reject incident
                      </button>
                    )}
                  </section>
                </div>
              </details>
            ) : (
              <p className={styles.roleHint}>Team assignment, score overrides, AI re-evaluation, and rejection are admin-only.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function TopBar({ staff, lastRefreshed }: { staff: StaffUser | null; lastRefreshed: string | null }) {
  return (
    <header className={styles.topBar}>
      <div className={styles.lastUpdated}>
        <ClockIcon />
        <span>Last updated: <time dateTime={lastRefreshed ?? undefined}>{lastRefreshed ? formatDate(lastRefreshed) : "Not refreshed yet"}</time></span>
      </div>
      {staff && <span className={styles.headerAvatar} aria-label={`${staff.fullName ?? staff.email ?? "Staff"} · ${staff.role}`}><UserIcon /></span>}
    </header>
  );
}

function lowConfidenceLabel(latest: DossierClassification | undefined) {
  const threshold = formatPercent(CONFIDENCE_THRESHOLD);
  const parts: string[] = [];
  if (latest && latest.confidence < CONFIDENCE_THRESHOLD) parts.push(`type ${formatPercent(latest.confidence)}`);
  if (latest?.severityConfidence != null && latest.severityConfidence < CONFIDENCE_THRESHOLD) parts.push(`severity ${formatPercent(latest.severityConfidence)}`);
  return `Low confidence (${parts.join(", ") || "below threshold"}; review below ${threshold})`;
}

function ReviewBanner({
  latest,
  reasons,
  pending,
}: {
  latest: DossierClassification | undefined;
  reasons: ReturnType<typeof checkFirstReasons>;
  pending: boolean;
}) {
  const labels = reasons.map((reason) => ({
    low_confidence: lowConfidenceLabel(latest),
    high_severity: "High severity",
    possible_hoax: "Possible hoax flag",
  })[reason]);

  return (
    <section className={styles.reviewBanner} aria-label="Human review required">
      <ReviewIcon />
      <div>
        <strong>Needs human review</strong>
        {latest && <span>Confidence {formatPercent(latest.confidence)}</span>}
        <p>{labels.length ? labels.join(" · ") : pending ? "Incident status is pending review." : "Existing classification review flag."}</p>
      </div>
    </section>
  );
}

function StatusTimeline({ detail }: { detail: DossierIncidentDetail }) {
  const statuses = lifecycleStatuses(detail);
  return (
    <ol className={styles.timeline}>
      {statuses.map((item, index) => (
        <li key={`${item.status}-${item.createdAt ?? index}`} className={index === statuses.length - 1 ? styles.timelineCurrent : ""}>
          <span className={styles.timelineMarker} aria-hidden="true">{index + 1}</span>
          <strong>{titleCase(item.status)}</strong>
          {item.createdAt
            ? <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
            : <span className={styles.timelineTime}>Timestamp unavailable</span>}
        </li>
      ))}
    </ol>
  );
}

function lifecycleStatuses(detail: DossierIncidentDetail) {
  const events = [...detail.auditLog].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const statuses: { status: ReportStatus; createdAt: string | null }[] = [];

  for (const event of events) {
    const after = event.after;
    if (!after || typeof after !== "object" || !("status" in after)) continue;
    const status = REPORT_STATUSES.find((value) => value === after.status);
    if (!status || statuses[statuses.length - 1]?.status === status) continue;
    statuses.push({ status, createdAt: event.createdAt });
  }

  if (statuses[statuses.length - 1]?.status !== detail.status) {
    statuses.push({ status: detail.status, createdAt: null });
  }
  return statuses;
}

function PriorityBreakdown({ detail }: { detail: DossierIncidentDetail }) {
  const factors: { key: keyof typeof PRIORITY_WEIGHTS; label: string }[] = [
    { key: "severity", label: "Severity" },
    { key: "population", label: "Population" },
    { key: "locationRisk", label: "Location risk" },
    { key: "type", label: "Type" },
  ];

  return (
    <section className={styles.card} aria-labelledby="priority-title">
      <CardHeading icon={<ScoreIcon />} title="Priority Score Breakdown" id="priority-title" />
      {detail.priority ? (
        <>
          <div className={styles.factorList}>
            {factors.map(({ key, label }) => {
              const value = detail.priority?.breakdown?.[key];
              const maximum = PRIORITY_WEIGHTS[key] * 100;
              const width = value === undefined ? 0 : Math.max(0, Math.min(100, value / maximum * 100));
              return (
                <div className={styles.factor} key={key}>
                  <div className={styles.dataLabel}><strong>{label}</strong><span>{value === undefined ? "—" : formatScore(value)} / {formatScore(maximum)}</span></div>
                  <span className={styles.factorTrack} role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={maximum}>
                    <span style={{ width: `${width}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
          <div className={styles.totalScore}><span>Total priority score</span><strong>{formatScore(detail.priority.score)} / 100</strong></div>
        </>
      ) : <p className={styles.emptyText}>Priority score not available.</p>}
    </section>
  );
}

function CardHeading({
  icon,
  title,
  id,
  children,
}: {
  icon: ReactNode;
  title: string;
  id: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.cardHeading}>
      <span className={styles.cardIcon} aria-hidden="true">{icon}</span>
      <h2 id={id}>{title}</h2>
      {children}
    </header>
  );
}

function DataPair({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.dataPair}>
      <span className={styles.overline}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" />
      <path d="M5 17a3 3 0 0 1 3-3h10" />
    </svg>
  );
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    status_changed: "Status changed",
    team_assigned: "Team assigned",
    report_classified: "Report classified",
    report_submitted: "Report submitted",
    report_reviewed: "Classification confirmed by staff",
    report_rejected: "Marked as false alarm",
    reclassified: "AI re-run",
    priority_overridden: "Priority score overridden",
    ai_fallback_used: "AI fallback used",
    classification_error: "AI classification failed",
  };
  return labels[action] ?? action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function openMapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

function isDemoData(detail: DossierIncidentDetail) {
  const placeholderAreas = ["Sample Area A", "Sample Area B", "Sample Area C"];
  return detail.trackingCode.startsWith("SGP-DEM") ||
    (detail.location.area !== null && placeholderAreas.includes(detail.location.area));
}

function formatCoordinates(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : "—";
}

function formatDate(value: string) {
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

function titleCase(value: string | Severity) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ListIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M7 5h10M7 10h10M7 15h10" /><circle cx="3.5" cy="5" r=".7" /><circle cx="3.5" cy="10" r=".7" /><circle cx="3.5" cy="15" r=".7" /></svg>;
}

function ReviewIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 4h14v13H3zM6 2v4m8-4v4M6 9h8m-8 4h5" /></svg>;
}

function AnalyticsIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 17h14M5 14V9m5 5V4m5 10V7" /></svg>;
}

function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c.8-3.1 3-4.7 6.5-4.7s5.7 1.6 6.5 4.7" /></svg>;
}

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M10 4H5v16h5m5-4 4-4-4-4m4 4H9" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 5v5l3 2" /></svg>;
}

function PhotoIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="1" /><circle cx="7" cy="8" r="1.3" /><path d="m3 14 4.5-4 3.2 2.4 2.2-2 4.1 3.6" /></svg>;
}

function MapIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m2 4 5-2 6 2 5-2v14l-5 2-6-2-5 2V4Z" /><path d="M7 2v14m6-12v14" /></svg>;
}

function HistoryIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3.3 7A7 7 0 1 1 3 11m.3-7v4h4" /><path d="M10 6v4l2.5 1.5" /></svg>;
}

function AiIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M10 2.5a5 5 0 0 0-2.5 9.3V15h5v-3.2A5 5 0 0 0 10 2.5Zm-2.5 15h5M10 1v1" /><path d="m3 5 1.5 1M17 5l-1.5 1" /></svg>;
}

function ScoreIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="1" /><path d="M6 13l2.5-3 2 1.5L14 7" /></svg>;
}

function VerificationIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="6" r="3" /><path d="M2.5 17c.3-3.2 2.2-5 5.5-5 1.2 0 2.2.3 3 .8m2.5-.3 1.5 1.5 3-3" /></svg>;
}

function TeamIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5" /><circle cx="14" cy="7" r="2" /><path d="M2 17c.3-3 2-4.5 5-4.5s4.7 1.5 5 4.5m1-4c2.6-.1 4 1.2 4.2 4" /></svg>;
}

function TranscriptIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 5h14v10H8l-4 3V5Z" /><path d="M6 8h8m-8 3h6" /></svg>;
}

function ExternalLinkIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 2h5v5m0-5L7 9" /><path d="M12 9v4H3V4h4" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m2 8 4 4 8-8" /></svg>;
}

function ReopenIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M13 6a5.5 5.5 0 0 0-9.5-2L2 5m0-3v3h3m-2 3a5.5 5.5 0 0 0 9.5 2L14 9m0 3V9h-3" /></svg>;
}

