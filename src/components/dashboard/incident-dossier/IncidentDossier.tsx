"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  STATUS_TRANSITIONS,
} from "@/lib/constants";
import {
  ASSIGNABLE_STATUSES,
  stepFor,
  TRANSITION_LABELS,
} from "@/lib/workflow";
import type { ReportStatus, Severity } from "@/types";
import { severityWithPercent } from "@/lib/severity-label";
import { DossierMiniMap } from "./DossierMiniMap";
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

interface PendingConfirmation {
  prompt: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<void>;
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
  const initials = initialsFor(staffName);
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
          <span className={styles.brandMark} aria-hidden="true">
            <Image src="/brand/sagip-ai-mark.svg" alt="" width={30} height={30} loading="eager" />
          </span>
          <span className={styles.brandCopy}>
            <strong>SAGIP-AI</strong>
            <span>Staff Operations</span>
          </span>
        </Link>
        <nav aria-label="Primary">
          <ul className={styles.navList}>
            <li>
              <Link href="/dashboard" className={`${styles.navLink} ${styles.navLinkActive}`} aria-current="page">
                <ListIcon />
                <span>Incidents</span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/review" className={styles.navLink}>
                <ReviewIcon />
                <span>Review queue</span>
                {reviewCount !== null && (
                  <span className={styles.navBadge} aria-label={`${reviewCount} items in review queue`}>
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
        {reviewCountError && (
          <p className={styles.queueError} role="alert">
            {reviewCountError}
          </p>
        )}

        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.citizenLink}>
            <span>Citizen Portal</span>
            <ExternalLinkIcon />
          </Link>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">
              {initials}
            </span>
            <span className={styles.accountCopy}>
              <strong>{staffName}</strong>
              <span>{staff?.role ?? "Staff"}</span>
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
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <nav className={styles.compactNav} aria-label="Staff navigation">
          <Link href="/dashboard" className={styles.compactBrand}>
            <Image src="/brand/sagip-ai-mark.svg" alt="" width={24} height={24} loading="eager" />
            <strong>SAGIP-AI</strong>
            <span>Staff</span>
          </Link>
          <div className={styles.compactLinks}>
            <Link href="/dashboard" className={`${styles.compactLink} ${styles.compactLinkActive}`}>
              Incidents
            </Link>
            <Link href="/dashboard/review" className={styles.compactLink}>
              Review
              {reviewCount !== null && <span className={styles.navBadge}>{reviewCount}</span>}
            </Link>
            <Link href="/dashboard/analytics" className={styles.compactLink}>
              Analytics
            </Link>
          </div>
        </nav>

        {error ? (
          <main className={styles.shellMessage} role="alert">
            {error}
          </main>
        ) : staff ? (
          children
        ) : (
          <main className={styles.shellMessage} aria-busy="true">
            Loading staff session...
          </main>
        )}
      </div>
    </div>
  );
}

const LIFECYCLE_STEPS = [
  { key: "received", label: "Received" },
  { key: "review", label: "Reviewed" },
  { key: "assign", label: "Assign" },
  { key: "respond", label: "Responding" },
  { key: "done", label: "Resolved" },
] as const;

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
  onRefresh,
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
  onRefresh?: () => void;
  photoFailed: boolean;
  onPhotoError: () => void;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [reassignTeamId, setReassignTeamId] = useState("");
  const [score, setScore] = useState("");
  const [reason, setReason] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setLightboxOpen(false);
      setActivityOpen(false);
      setAdminMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!adminMenuOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [adminMenuOpen]);

  if (state !== "ready" || !detail) {
    const title = state === "notFound"
      ? "Incident not found"
      : state === "error"
        ? "Unable to load incident"
        : "Loading incident";
    return (
      <main className={styles.content}>
        <header className={styles.topBar}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/dashboard">Incidents</Link>
          </nav>
          <div className={styles.topBarRight}>
            <UpdatedTimestamp lastRefreshed={lastRefreshed} />
          </div>
        </header>
        <section
          className={state === "loading" ? styles.loadingCard : styles.stateCard}
          role={state === "error" || state === "notFound" ? "alert" : undefined}
          aria-busy={state === "loading"}
        >
          {state === "loading" ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              <h1>{title}</h1>
            </>
          ) : (
            <>
              <h1>{title}</h1>
              <p>{state === "notFound" ? "This incident may have been removed or is no longer available." : stateMessage}</p>
              <button type="button" className={styles.buttonPrimary} onClick={onRetry}>
                Retry
              </button>
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
  const transitions = (STATUS_TRANSITIONS[detail.status] ?? []).filter((status) => status !== "rejected");
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
  const needsReview = detail.status === "pending_review" || detail.status === "received";
  const isCurrentStepReview = step?.key === "review";
  const stepTitle = detail.status === "rejected"
    ? "Incident rejected"
    : step?.next ?? titleCase(detail.status);
  const stepStageIndex = lifecycleStageIndex(detail.status);
  const mapUrl = openMapUrl(detail.location.lat, detail.location.lng);

  function copyTrackingCode() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(incident.trackingCode).catch(() => {});
    }
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  }

  function requestAssignTeam(teamId: string, label: string, reset: () => void) {
    if (!teamId) return;
    const team = teams.find((item) => item.id === teamId);
    setAdminMenuOpen(false);
    setPendingConfirm({
      prompt: `Confirm ${label.toLowerCase()}${team ? ` to ${team.name}` : ""} for ${incident.trackingCode}?`,
      confirmLabel: label,
      run: async () => {
        const saved = await onAction({
          label,
          path: `/api/incidents/${incident.id}/assign`,
          method: "POST",
          json: { teamId },
        });
        if (saved) reset();
      },
    });
  }

  function requestSaveOverride() {
    const parsed = Number(score);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100 || !reason.trim()) return;
    setPendingConfirm({
      prompt: `Override priority score to ${formatScore(parsed)}? Reason: "${reason.trim()}"`,
      confirmLabel: "Save override",
      run: async () => {
        const saved = await onAction({
          label: "Priority override",
          path: `/api/incidents/${incident.id}/priority`,
          method: "PATCH",
          json: { score: parsed, reason: reason.trim() },
        });
        if (saved) {
          setOverrideOpen(false);
          setScore("");
          setReason("");
        }
      },
    });
  }

  function requestRerunAi() {
    setAdminMenuOpen(false);
    setPendingConfirm({
      prompt: `Re-run AI on ${incident.trackingCode}? Its draft type and severity may update.`,
      confirmLabel: "Re-run AI",
      run: async () => {
        await onAction({
          label: "Re-run AI",
          path: `/api/incidents/${incident.id}/reclassify`,
          method: "POST",
        });
      },
    });
  }

  function requestReject() {
    setAdminMenuOpen(false);
    setPendingConfirm({
      prompt: `Reject ${incident.trackingCode} as not a real incident?`,
      confirmLabel: "Reject incident",
      danger: true,
      run: async () => {
        await onAction({
          label: "Reject incident",
          path: `/api/incidents/${incident.id}/status`,
          method: "PATCH",
          json: { status: "rejected" },
        });
      },
    });
  }

  function transitionAction(status: ReportStatus) {
    const label = incident.status === "resolved" && status === "in_progress"
      ? "Reopen"
      : TRANSITION_LABELS[status] ?? titleCase(status);
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

  const agreedWithAi = Boolean(
    latest &&
    detail.review &&
    latest.incidentType === detail.review.finalType &&
    latest.severity === detail.review.finalSeverity
  );

  return (
    <main className={styles.content}>
      {/* Clean Topbar: Activity drawer + Admin actions menu tucked neatly here */}
      <header className={styles.topBar}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/dashboard">Incidents</Link>
          <span aria-hidden="true">/</span>
          <code>{detail.trackingCode}</code>
        </nav>

        <div className={styles.topBarRight}>
          <UpdatedTimestamp lastRefreshed={lastRefreshed} />

          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => setActivityOpen(true)}
          >
            <ClockIcon />
            Activity
            <span className={styles.countChip}>{detail.auditLog.length}</span>
          </button>

          {isAdmin && (
            <div className={styles.menuWrap} ref={menuWrapRef}>
              <button
                type="button"
                className={styles.buttonSecondary}
                aria-expanded={adminMenuOpen}
                aria-haspopup="menu"
                onClick={() => setAdminMenuOpen((prev) => !prev)}
              >
                <ControlsIcon />
                Admin actions
                <ChevronDownIcon />
              </button>

              {adminMenuOpen && (
                <div className={styles.dropdownMenu} role="menu" aria-label="Admin actions">
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    disabled={busy}
                    onClick={requestRerunAi}
                  >
                    <ReopenIcon />
                    Re-run AI analysis
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    disabled={busy}
                    onClick={() => {
                      setAdminMenuOpen(false);
                      setOverrideOpen(true);
                    }}
                  >
                    <EditIcon />
                    Override priority score
                  </button>

                  {canAssign && detail.status !== "classified" && (
                    <>
                      <div className={styles.menuSep} />
                      <div className={styles.menuReassign}>
                        <span className={styles.overline} style={{ margin: 0 }}>Reassign team</span>
                        <select
                          className={`${styles.selectModern} ${styles.selectCompact}`}
                          aria-label="Choose team to reassign"
                          value={reassignTeamId}
                          onChange={(event) => setReassignTeamId(event.target.value)}
                          disabled={busy}
                        >
                          <option value="">Select team…</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id} disabled={team.id === incident.teamId}>
                              {team.name}{team.id === incident.teamId ? " (current)" : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={`${styles.buttonPrimary} ${styles.buttonSmall}`}
                          disabled={busy || !reassignTeamId}
                          onClick={() => requestAssignTeam(reassignTeamId, "Reassign team", () => setReassignTeamId(""))}
                        >
                          Reassign
                        </button>
                      </div>
                    </>
                  )}

                  {canReject && (
                    <>
                      <div className={styles.menuSep} />
                      <button
                        type="button"
                        className={`${styles.menuItem} ${styles.menuItemDanger}`}
                        role="menuitem"
                        disabled={busy}
                        onClick={requestReject}
                      >
                        <RejectIcon />
                        Reject as false alarm
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={onRefresh ?? onRetry}
            disabled={busy}
          >
            Refresh
          </button>
        </div>
      </header>

      <div className={styles.page}>
        {/* Compact Hero Command Card */}
        <section className={`${styles.heroCard} ${detail.priority?.band === "P1" ? styles.heroCritical : ""}`}>
          <div className={styles.heroTop}>
            <div className={styles.heroLeft}>
              <div className={styles.heroTitleRow}>
                <h1 className={styles.heroTitle}>
                  {detail.incidentType ? titleCase(detail.incidentType) : "Unconfirmed incident"}
                </h1>
                <span className={`${styles.pill} ${priorityPillClass(detail.priority?.band)}`}>
                  {priorityBandLabel(detail.priority?.band)}
                </span>
                <span className={`${styles.pill} ${statusPillClass(detail.status)}`}>
                  {titleCase(detail.status)}
                </span>
                {detail.priority && (
                  <span className={styles.pillScore}>{formatScore(detail.priority.score)}</span>
                )}
                {demoData && <span className={`${styles.pill} ${styles.pillMuted}`}>Demo data</span>}
              </div>

              <div className={styles.heroMeta}>
                <button
                  type="button"
                  className={styles.codeCopy}
                  onClick={copyTrackingCode}
                  title="Copy tracking code"
                >
                  {copiedCode ? "Copied!" : detail.trackingCode}
                </button>
                <span>{detail.location.area ?? "Unknown area"}</span>
                <time dateTime={detail.createdAt}>{formatShortDate(detail.createdAt)}</time>
                <span>
                  Team: <strong>{currentTeam?.name ?? (detail.teamId ? "Unavailable" : "Unassigned")}</strong>
                </span>
              </div>
            </div>

            <div className={styles.stepper} aria-label="Incident lifecycle">
              {detail.status === "rejected" ? (
                <span className={`${styles.stepPill} ${styles.stepPillRejected}`}>Rejected</span>
              ) : (
                LIFECYCLE_STEPS.map((item, index) => {
                  const done = index < stepStageIndex || stepStageIndex === 4;
                  const current = index === stepStageIndex && stepStageIndex < 4;
                  return (
                    <span key={item.key} className={styles.stepItem}>
                      {index > 0 && <span className={styles.stepSep} aria-hidden="true">›</span>}
                      <span
                        className={`${styles.stepPill} ${done ? styles.stepPillDone : ""} ${current ? styles.stepPillCurrent : ""}`}
                      >
                        {done ? "✓ " : ""}
                        {item.label}
                      </span>
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {needsReview && (
            <ReviewBanner
              latest={latest}
              reasons={reviewReasons}
              pending={detail.status === "pending_review"}
            />
          )}

          <div className={styles.actionStrip}>
            <div className={styles.actionStripCopy}>
              <strong>Next step: {stepTitle}</strong>
              <span>{nextStepDescription(detail, currentTeam?.name ?? null)}</span>
            </div>
            <div className={styles.actionControls}>
              {isCurrentStepReview && (
                <a className={styles.buttonPrimary} href="#human-verification">
                  Review now
                </a>
              )}
              {step?.key === "assign" && (
                isAdmin ? (
                  <>
                    <select
                      className={styles.selectModern}
                      aria-label="Choose response team"
                      value={selectedTeamId}
                      onChange={(event) => setSelectedTeamId(event.target.value)}
                      disabled={busy}
                    >
                      <option value="">Select response team…</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id} disabled={team.id === incident.teamId}>
                          {team.name}{team.id === incident.teamId ? " (current)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.buttonPrimary}
                      disabled={busy || !selectedTeamId}
                      onClick={() => requestAssignTeam(selectedTeamId, "Assign team", () => setSelectedTeamId(""))}
                    >
                      Assign team
                    </button>
                  </>
                ) : (
                  <span className={styles.mutedMessage}>Waiting for an admin to assign a team.</span>
                )
              )}
              {(step?.key === "respond" || step?.key === "done") && transitions.map(transitionAction)}
              {step?.key === "respond" && !isAdmin && !onTeam && (
                <span className={styles.mutedMessage}>
                  Only {currentTeam?.name ?? "the assigned team"} or an admin can update this.
                </span>
              )}
            </div>
          </div>

          {pendingConfirm && (
            <div className={styles.inlineConfirm} role="alert">
              <span>{pendingConfirm.prompt}</span>
              <div className={styles.inlineConfirmActions}>
                <button
                  type="button"
                  className={`${pendingConfirm.danger ? styles.buttonDangerSoft : styles.buttonPrimary} ${styles.buttonSmall}`}
                  disabled={busy}
                  onClick={() => {
                    const action = pendingConfirm;
                    setPendingConfirm(null);
                    void action.run();
                  }}
                >
                  {pendingConfirm.confirmLabel}
                </button>
                <button
                  type="button"
                  className={`${styles.buttonSecondary} ${styles.buttonSmall}`}
                  disabled={busy}
                  onClick={() => setPendingConfirm(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(error || message || teamsError) && (
            <p
              className={`${styles.feedbackBar} ${error || teamsError ? styles.feedbackError : styles.feedbackSuccess}`}
              role={error || teamsError ? "alert" : "status"}
            >
              {error ?? (teamsError ? `Teams could not be loaded: ${teamsError}` : message)}
            </p>
          )}
        </section>

        {/* ONLY THE 3 ESSENTIAL CARDS — Clean, Spacious, Zero Clutter */}
        <div className={styles.grid3}>
          {/* CARD 1: Evidence & Location */}
          <section className={styles.card} aria-labelledby="evidence-title">
            <div className={styles.cardHead}>
              <h2 className={styles.cardHeadTitle} id="evidence-title">
                <PhotoIcon />
                Evidence &amp; Location
              </h2>
              <span className={styles.coordsTag}>
                {Number.isFinite(detail.location.lat) && Number.isFinite(detail.location.lng)
                  ? `${detail.location.lat.toFixed(4)}, ${detail.location.lng.toFixed(4)}`
                  : "No coords"}
              </span>
            </div>

            {detail.photoUrl && !photoFailed ? (
              <button
                type="button"
                className={styles.photoBox}
                onClick={() => setLightboxOpen(true)}
                aria-label="Inspect full evidence photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed evidence URL returned by the staff API */}
                <img
                  src={detail.photoUrl}
                  alt={`Evidence photo for ${detail.trackingCode}: ${detail.description || "incident report"}`}
                  onError={onPhotoError}
                />
                <span className={styles.photoOverlayBtn}>Inspect photo</span>
              </button>
            ) : (
              <div className={styles.photoFallback} role="status">
                <PhotoIcon />
                <strong>{photoFailed ? "Photo unavailable" : "No photo attached"}</strong>
              </div>
            )}

            <DossierMiniMap
              lat={detail.location.lat}
              lng={detail.location.lng}
              area={detail.location.area}
              openMapUrl={mapUrl}
            />

            <div className={styles.citizenQuote}>
              <span className={styles.overline}>What the citizen wrote</span>
              {detail.description ? (
                <p>“{detail.description}”</p>
              ) : (
                <p className={styles.emptyText}>No description recorded.</p>
              )}
            </div>
          </section>

          {/* CARD 2: Verification & AI Analysis */}
          <section
            className={`${styles.card} ${isCurrentStepReview ? styles.cardScrollable : ""}`}
            id="human-verification"
            aria-labelledby="verification-title"
          >
            <div className={styles.cardHead}>
              <h2 className={styles.cardHeadTitle} id="verification-title">
                <VerificationIcon />
                Verification &amp; AI Analysis
              </h2>
              <span className={`${styles.pill} ${detail.review ? styles.pillStatusResolved : styles.pillStatusReview}`}>
                {detail.review ? "Confirmed" : "Pending review"}
              </span>
            </div>

            <div className={styles.compareBox}>
              <div className={styles.cmpPanel}>
                <span className={styles.overline}>
                  AI Draft{latest ? ` (${shortModelName(latest.model)})` : ""}
                </span>
                {latest ? (
                  <>
                    <div className={styles.cmpMain}>
                      {titleCase(latest.incidentType)} · {titleCase(latest.severity)}
                    </div>
                    <div className={styles.cmpSub}>
                      {latest.severityConfidence != null
                        ? `Severity conf: ${Math.round(latest.severityConfidence * 100)}%`
                        : "Severity conf: —"}
                    </div>
                  </>
                ) : (
                  <div className={styles.cmpSub}>No AI result yet</div>
                )}
              </div>

              <div className={`${styles.cmpPanel} ${detail.review ? styles.cmpPanelConfirmed : ""}`}>
                <span className={styles.overline}>Human Confirmed</span>
                {detail.review ? (
                  <>
                    <div className={`${styles.cmpMain} ${styles.cmpMainConfirmed}`}>
                      {titleCase(detail.review.finalType)} · {titleCase(detail.review.finalSeverity)}
                    </div>
                    <div className={`${styles.cmpSub} ${styles.cmpSubConfirmed}`}>
                      {agreedWithAi ? "Agreed with AI" : "Adjusted by staff"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.cmpMain}>
                      {detail.incidentType ? titleCase(detail.incidentType) : "Not confirmed"}
                    </div>
                    <div className={styles.cmpSub}>Awaiting staff confirmation</div>
                  </>
                )}
              </div>
            </div>

            {latest && (
              <>
                <div className={styles.metricBlock}>
                  <div className={styles.confBarRow}>
                    <span>Type confidence</span>
                    <strong>{formatPercent(latest.confidence)}</strong>
                  </div>
                  <span
                    className={styles.barTrack}
                    role="meter"
                    aria-label="AI type confidence"
                    aria-valuenow={Math.round(latest.confidence * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      className={styles.barFill}
                      style={{ width: `${Math.min(100, Math.max(0, latest.confidence * 100))}%` }}
                    />
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <div className={styles.hazardsInline}>
                    <span className={styles.overline} style={{ margin: 0 }}>Hazards</span>
                    {latest.hazards.length > 0 ? (
                      latest.hazards.map((hazard, index) => (
                        <span className={styles.hazardPill} key={`${hazard}-${index}`}>
                          {hazard}
                        </span>
                      ))
                    ) : (
                      <span className={styles.emptyText}>None</span>
                    )}
                  </div>
                  <span className={styles.coordsTag}>
                    {latest.latencyMs != null ? `${latest.latencyMs} ms · ` : ""}
                    {detail.classifications.length} {detail.classifications.length === 1 ? "run" : "runs"}
                  </span>
                </div>
              </>
            )}

            {detail.classifications.length > 1 && (
              <details className={styles.historyDisclosure}>
                <summary>Past AI runs ({detail.classifications.length})</summary>
                <div className={styles.tableScroller}>
                  <table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Severity</th>
                        <th>Conf</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.classifications.map((classification) => (
                        <tr key={classification.id}>
                          <td>{formatShortDate(classification.createdAt)}</td>
                          <td>{shortModelName(classification.model)}</td>
                          <td>{titleCase(classification.incidentType)}</td>
                          <td>{severityWithPercent(classification.severity, classification.severityConfidence)}</td>
                          <td>{formatPercent(classification.confidence)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {isCurrentStepReview ? (
              <div className={styles.reviewFormWrap}>
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
            ) : detail.review ? (
              <div className={styles.reviewerNote}>
                <span className={styles.overline}>Reviewer note</span>
                {detail.review.notes ? `“${detail.review.notes}”` : "No reviewer note added."}
                <span className={styles.reviewerMeta}>
                  Confirmed by {detail.review.reviewer?.full_name ?? "Staff"} · {formatShortDate(detail.review.createdAt)}
                </span>
              </div>
            ) : null}
          </section>

          {/* CARD 3: Priority Score */}
          <PriorityBreakdownCard
            detail={detail}
            isAdmin={isAdmin}
            busy={busy}
            overrideOpen={overrideOpen}
            setOverrideOpen={setOverrideOpen}
            score={score}
            setScore={setScore}
            reason={reason}
            setReason={setReason}
            onSaveOverride={requestSaveOverride}
            onOpenHistory={() => setActivityOpen(true)}
          />
        </div>
      </div>

      {/* On-Demand Slide-Over Activity Drawer */}
      {activityOpen && (
        <div
          className={styles.drawerBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Incident activity trail"
          onClick={(event) => {
            if (event.target === event.currentTarget) setActivityOpen(false);
          }}
        >
          <div className={styles.drawer}>
            <div className={styles.drawerHead}>
              <h2 className={styles.drawerTitle}>
                <ClockIcon />
                Activity Trail
                <span className={styles.countChip}>{detail.auditLog.length}</span>
              </h2>
              <div className={styles.drawerHeadActions}>
                {detail.auditLog.length > 0 && (
                  <button
                    type="button"
                    className={styles.buttonGhost}
                    onClick={() => setShowRawJson((prev) => !prev)}
                  >
                    {showRawJson ? "Hide JSON" : "Raw JSON"}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => setActivityOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className={styles.drawerBody}>
              <div>
                <h3 className={styles.drawerSectionTitle}>Timeline</h3>
                {detail.auditLog.length > 0 ? (
                  <ol className={styles.auditList}>
                    {detail.auditLog.map((event, idx) => (
                      <li key={event.id} className={styles.auditItem}>
                        <div className={styles.auditRail}>
                          <span className={`${styles.auditDot} ${auditDotClass(event.action)}`} aria-hidden="true" />
                          {idx < detail.auditLog.length - 1 && <span className={styles.auditLine} aria-hidden="true" />}
                        </div>
                        <div className={styles.auditBody}>
                          <div className={styles.auditHead}>
                            <span className={styles.auditTitle}>{auditLabel(event.action)}</span>
                            <time className={styles.auditTime} dateTime={event.createdAt}>
                              {formatShortDate(event.createdAt)}
                            </time>
                          </div>
                          <div className={styles.auditDesc}>{summarizeAuditEvent(event)}</div>
                          {showRawJson && (
                            <pre className={styles.jsonPre}>
                              {JSON.stringify({ before: event.before, after: event.after, actorId: event.actorId }, null, 2)}
                            </pre>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.emptyText}>No recorded activity yet.</p>
                )}
              </div>

              {detail.assignments.length > 0 && (
                <div>
                  <h3 className={styles.drawerSectionTitle}>Team assignment history</h3>
                  <ul className={styles.assignmentList}>
                    {detail.assignments.map((assignment) => (
                      <li key={assignment.id}>
                        <div>
                          <strong>{assignment.team?.name ?? "Team unavailable"}</strong>
                          {assignment.assignedBy?.full_name ? (
                            <div>Assigned by {assignment.assignedBy.full_name}</div>
                          ) : null}
                        </div>
                        <time className={styles.auditTime} dateTime={assignment.assignedAt}>
                          {formatShortDate(assignment.assignedAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {lightboxOpen && detail.photoUrl && !photoFailed && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Full evidence photo for ${detail.trackingCode}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightboxOpen(false);
          }}
        >
          <div className={styles.lightboxInner}>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed evidence URL returned by the staff API */}
            <img src={detail.photoUrl} alt={`Full evidence photo for ${detail.trackingCode}`} />
            <div className={styles.lightboxBar}>
              <span>
                {detail.trackingCode} · {detail.location.area ?? "Unknown area"} · {formatShortDate(detail.createdAt)}
              </span>
              <div className={styles.lightboxActions}>
                <a className={styles.lightboxLink} href={detail.photoUrl} target="_blank" rel="noreferrer">
                  Open original
                </a>
                <button
                  type="button"
                  className={`${styles.buttonSecondary} ${styles.buttonSmall}`}
                  onClick={() => setLightboxOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function UpdatedTimestamp({ lastRefreshed }: { lastRefreshed: string | null }) {
  return (
    <span className={styles.lastUpdated}>
      <ClockIcon />
      <span>
        Updated{" "}
        <time dateTime={lastRefreshed ?? undefined}>
          {lastRefreshed
            ? new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: "Asia/Manila" }).format(
                new Date(lastRefreshed)
              )
            : "—"}
        </time>
      </span>
    </span>
  );
}

function PriorityBreakdownCard({
  detail,
  isAdmin,
  busy,
  overrideOpen,
  setOverrideOpen,
  score,
  setScore,
  reason,
  setReason,
  onSaveOverride,
  onOpenHistory,
}: {
  detail: DossierIncidentDetail;
  isAdmin: boolean;
  busy: boolean;
  overrideOpen: boolean;
  setOverrideOpen: (open: boolean) => void;
  score: string;
  setScore: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  onSaveOverride: () => void;
  onOpenHistory: () => void;
}) {
  const factors: { key: keyof typeof PRIORITY_WEIGHTS; label: string; fillClass: string }[] = [
    { key: "severity", label: "Severity (45%)", fillClass: styles.barFillDanger },
    { key: "population", label: "Population (25%)", fillClass: "" },
    { key: "locationRisk", label: "Location risk (15%)", fillClass: styles.barFillAmber },
    { key: "type", label: "Incident type (15%)", fillClass: styles.barFillTeal },
  ];

  return (
    <section className={styles.card} aria-labelledby="priority-title">
      <div className={styles.cardHead}>
        <h2 className={styles.cardHeadTitle} id="priority-title">
          <ScoreIcon />
          Priority Score
        </h2>
        {isAdmin && (
          <button
            type="button"
            className={styles.buttonGhost}
            onClick={() => setOverrideOpen(!overrideOpen)}
          >
            {overrideOpen ? "Close" : "Override"}
          </button>
        )}
      </div>

      {detail.priority ? (
        <>
          <div className={styles.scoreHero}>
            <div>
              <span className={styles.scoreBig}>{formatScore(detail.priority.score)}</span>
              <span className={styles.scoreOutOf}> / 100</span>
            </div>
            <span className={`${styles.pill} ${priorityPillClass(detail.priority.band)}`}>
              {detail.priority.overridden ? `${detail.priority.band} · Overridden` : priorityBandLabel(detail.priority.band)}
            </span>
          </div>

          <div className={styles.scoreList}>
            {factors.map(({ key, label, fillClass }) => {
              const value = detail.priority?.breakdown?.[key];
              const maximum = PRIORITY_WEIGHTS[key] * 100;
              const width = value === undefined ? 0 : Math.max(0, Math.min(100, (value / maximum) * 100));
              return (
                <div key={key}>
                  <div className={styles.scoreRowHead}>
                    <strong>{label}</strong>
                    <span>
                      {value === undefined ? "—" : formatScore(value)} / {formatScore(maximum)}
                    </span>
                  </div>
                  <span
                    className={styles.barTrack}
                    role="meter"
                    aria-label={label}
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={maximum}
                  >
                    <span className={`${styles.barFill} ${fillClass}`} style={{ width: `${width}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className={styles.emptyText}>Priority score not available.</p>
      )}

      {isAdmin && overrideOpen && (
        <div className={styles.overrideDrawer}>
          <div className={styles.overrideInputs}>
            <input
              className={styles.inputField}
              type="number"
              min={0}
              max={100}
              step={0.5}
              placeholder="0–100"
              aria-label="New priority score (0 to 100)"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              disabled={busy}
            />
            <input
              className={styles.inputField}
              placeholder="Audit reason (required)"
              aria-label="Reason for priority score override"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className={styles.overrideActions}>
            <button
              type="button"
              className={`${styles.buttonSecondary} ${styles.buttonSmall}`}
              onClick={() => setOverrideOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.buttonPrimary} ${styles.buttonSmall}`}
              disabled={busy || !score || !reason.trim()}
              onClick={onSaveOverride}
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className={styles.scoreFooter}>
        <span>{detail.priority?.overridden ? "Manually overridden by admin" : "Calculated from incident inputs"}</span>
        <button type="button" className={styles.buttonGhost} onClick={onOpenHistory}>
          View history →
        </button>
      </div>
    </section>
  );
}

function lowConfidenceLabel(latest: DossierClassification | undefined) {
  const threshold = formatPercent(CONFIDENCE_THRESHOLD);
  const parts: string[] = [];
  if (latest && latest.confidence < CONFIDENCE_THRESHOLD) parts.push(`type ${formatPercent(latest.confidence)}`);
  if (latest?.severityConfidence != null && latest.severityConfidence < CONFIDENCE_THRESHOLD) {
    parts.push(`severity ${formatPercent(latest.severityConfidence)}`);
  }
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
      <p>
        <strong>Check first:</strong>{" "}
        {labels.length ? labels.join(" · ") : pending ? "Waiting for review" : "Flagged for review"}
        {latest && ` · AI ${formatPercent(latest.confidence)} sure`}
      </p>
    </section>
  );
}

function lifecycleStageIndex(status: ReportStatus): number {
  switch (status) {
    case "received":
      return 0;
    case "pending_review":
      return 1;
    case "classified":
      return 2;
    case "assigned":
    case "in_progress":
      return 3;
    case "resolved":
      return 4;
    default:
      return 0;
  }
}

function nextStepDescription(detail: DossierIncidentDetail, teamName: string | null): string {
  switch (detail.status) {
    case "received":
      return "AI is analyzing the submitted photo and report.";
    case "pending_review":
      return "Confirm or correct the AI draft before dispatch.";
    case "classified":
      return detail.review?.reviewer?.full_name
        ? `Confirmed by ${detail.review.reviewer.full_name} — dispatch a response team.`
        : "Type and severity confirmed — dispatch a response team.";
    case "assigned":
      return `${teamName ?? "Assigned team"} notified — start response when en route.`;
    case "in_progress":
      return `${teamName ?? "Response team"} is responding — mark resolved when cleared.`;
    case "resolved":
      return "Incident closed. Reopen if response continues.";
    case "rejected":
      return "Marked as not a real incident.";
    default:
      return "";
  }
}

function priorityBandLabel(band: string | undefined): string {
  switch (band) {
    case "P1":
      return "P1 Immediate";
    case "P2":
      return "P2 Urgent";
    case "P3":
      return "P3 Standard";
    case "P4":
      return "P4 Low";
    default:
      return "Priority unavailable";
  }
}

function priorityPillClass(band: string | undefined): string {
  switch (band) {
    case "P1":
      return styles.pillP1;
    case "P2":
      return styles.pillP2;
    case "P3":
      return styles.pillP3;
    default:
      return styles.pillP4;
  }
}

function statusPillClass(status: ReportStatus): string {
  switch (status) {
    case "pending_review":
    case "received":
      return styles.pillStatusReview;
    case "assigned":
      return styles.pillStatusAssigned;
    case "in_progress":
      return styles.pillStatusProgress;
    case "resolved":
      return styles.pillStatusResolved;
    case "rejected":
      return styles.pillStatusRejected;
    default:
      return styles.pillStatus;
  }
}

function auditDotClass(action: string): string {
  if (action === "report_reviewed" || action === "team_assigned" || action === "resolved") return styles.auditDotOk;
  if (action === "report_rejected" || action === "classification_error") return styles.auditDotDanger;
  if (action === "report_submitted") return styles.auditDotMuted;
  return "";
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    status_changed: "Status updated",
    team_assigned: "Team assigned",
    report_classified: "AI draft generated",
    report_submitted: "Citizen report received",
    report_reviewed: "Confirmed by staff",
    report_rejected: "Marked as false alarm",
    reclassified: "AI re-run completed",
    priority_overridden: "Priority score overridden",
    ai_fallback_used: "AI fallback used",
    classification_error: "AI classification failed",
  };
  return labels[action] ?? action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function summarizeAuditEvent(event: IncidentDetailData["auditLog"][number]): string {
  const after = asRecord(event.after);
  const before = asRecord(event.before);

  if (event.action === "status_changed" && typeof after?.status === "string") {
    const prev = typeof before?.status === "string" ? `${titleCase(before.status)} → ` : "";
    return `${prev}${titleCase(after.status)}.`;
  }
  if (event.action === "report_reviewed") {
    const rawType = after?.final_type ?? after?.finalType ?? after?.incident_type ?? after?.incidentType;
    const rawSev = after?.final_severity ?? after?.finalSeverity ?? after?.severity;
    const type = typeof rawType === "string" ? titleCase(rawType) : null;
    const sev = typeof rawSev === "string" ? titleCase(rawSev) : null;
    const notes = typeof after?.notes === "string" && after.notes.trim() ? ` Note: “${after.notes.trim()}”.` : "";
    if (type || sev) return `${[type, sev].filter(Boolean).join(" · ")}.${notes}`;
  }
  if (event.action === "priority_overridden" && typeof after?.score === "number") {
    const reasonText = typeof after?.reason === "string" ? ` Reason: “${after.reason}”.` : "";
    return `Score set to ${formatScore(after.score)}.${reasonText}`;
  }
  if (event.action === "team_assigned") {
    const name = typeof after?.team_name === "string"
      ? after.team_name
      : typeof after?.teamName === "string"
        ? after.teamName
        : "Response team dispatched";
    return `${name}.`;
  }
  if (event.action === "report_classified" || event.action === "reclassified") {
    const rawType = after?.incident_type ?? after?.incidentType;
    const rawSev = after?.severity;
    const type = typeof rawType === "string" ? titleCase(rawType) : null;
    const sev = typeof rawSev === "string" ? titleCase(rawSev) : null;
    if (type || sev) return `Draft: ${[type, sev].filter(Boolean).join(" · ")}.`;
  }
  if (event.action === "report_submitted") {
    return "Submitted with incident details and location.";
  }
  return "Recorded in incident audit log.";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function shortModelName(model: string): string {
  if (model.toLowerCase().includes("local") || model.toLowerCase().includes("onnx")) return "Local";
  if (model.toLowerCase().includes("gemini")) return "Gemini";
  return model.length > 16 ? `${model.slice(0, 15)}…` : model;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "ST";
}

function openMapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

function isDemoData(detail: DossierIncidentDetail) {
  const placeholderAreas = ["Sample Area A", "Sample Area B", "Sample Area C"];
  return (
    detail.trackingCode.startsWith("SGP-DEM") ||
    (detail.location.area !== null && placeholderAreas.includes(detail.location.area))
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

/* Crisp Stroke SVG Icons (Zero emojis) */
function ListIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
}

function ReviewIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
}

function AnalyticsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}


function LogoutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}

function PhotoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>;
}

function VerificationIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>;
}

function ScoreIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}

function ControlsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
}

function ChevronDownIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="11" height="11" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>;
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>;
}

function RejectIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
}

function ExternalLinkIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="12" height="12" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>;
}

function ReopenIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>;
}
