"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ReviewForm } from "@/components/dashboard/ReviewQueue";
import { useStaff } from "@/components/dashboard/StaffProvider";
import { Button, CameraIcon, ErrorText, Field, inputClass, Json, Panel, PriorityBadge, PriorityCircle, Tag } from "@/components/ui/basics";
import { SeverityChip } from "@/components/ui/SeverityChip";
import { api } from "@/lib/api-client";
import { PRIORITY_WEIGHTS, STATUS_TRANSITIONS } from "@/lib/constants";
import { ASSIGNABLE_STATUSES, stepFor, TRANSITION_LABELS, WORKFLOW } from "@/lib/workflow";
import type { ReportStatus, Severity } from "@/types";

interface Detail {
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
  classifications: { id: string; model: string; incidentType: string; severity: Severity; confidence: number; hazards: string[]; hoaxSuspected?: boolean; latencyMs: number | null; createdAt: string }[];
  review: { finalType: string; finalSeverity: string; notes: string | null; reviewer: { full_name: string | null } | null; createdAt: string } | null;
  assignments: { id: string; team: { id: string; name: string } | null; assignedAt: string }[];
  auditLog: { id: string; action: string; actorId: string | null; before: unknown; after: unknown; createdAt: string }[];
}

/** Score components in sketch order; each bar is filled relative to that component's maximum. */
const BARS: { key: keyof typeof PRIORITY_WEIGHTS; label: string }[] = [
  { key: "severity", label: "Severity" },
  { key: "population", label: "Population" },
  { key: "locationRisk", label: "Location risk" },
  { key: "type", label: "Type" },
];

const small = "px-3 py-1.5";

export function IncidentDetail({ id }: { id: string }) {
  const staff = useStaff();
  const isAdmin = staff?.role === "admin";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [score, setScore] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(
    () =>
      api<Detail>(`/api/incidents/${id}`).then((res) => {
        if (!res.ok) return setError(res.error);
        setError(null);
        setDetail(res.data);
      }),
    [id],
  );

  useEffect(() => {
    void load();
    void api<{ items: { id: string; name: string }[] }>("/api/teams").then((res) => res.ok && setTeams(res.data.items));
  }, [load]);

  async function act(label: string, path: string, method: string, json?: unknown) {
    setBusy(true);
    setMessage(null);
    const res = await api(path, { method, json });
    setBusy(false);
    if (!res.ok) return setError(`${label}: ${res.error}`);
    setError(null);
    setMessage(`${label}: done`);
    setOverrideOpen(false);
    setTeamId("");
    await load();
  }

  if (!detail) return error ? <ErrorText>{error}</ErrorText> : <p className="font-mono text-xs text-muted">Loading...</p>;

  const step = stepFor(detail.status);
  const stepIndex = step ? WORKFLOW.indexOf(step) : -1;
  const transitions = (STATUS_TRANSITIONS[detail.status] ?? []).filter((s) => s !== "rejected");
  const canReject = (STATUS_TRANSITIONS[detail.status] ?? []).includes("rejected");
  const currentTeam = teams.find((t) => t.id === detail.teamId);
  const onTeam = !!detail.teamId && detail.teamId === staff?.teamId;
  const latest = detail.classifications[0];
  const hazards = latest?.hazards ?? [];
  const canAssign = ASSIGNABLE_STATUSES.includes(detail.status);
  const transitionLabel = (s: string) => (detail.status === "resolved" && s === "in_progress" ? "Reopen" : TRANSITION_LABELS[s] ?? s);

  const assignForm = (label: string) => (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <Field label="Team">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputClass}>
            <option value="">Choose team</option>
            {teams.map((t) => <option key={t.id} value={t.id} disabled={t.id === detail.teamId}>{t.name}{t.id === detail.teamId ? " (current)" : ""}</option>)}
          </select>
        </Field>
      </div>
      <Button disabled={busy || !teamId} onClick={() => act(label, `/api/incidents/${id}/assign`, "POST", { teamId })}>{label}</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <Link href="/dashboard" className="font-mono text-[11px] uppercase underline">← Ranked list</Link>

      <Panel
        title="Incident detail"
        hint="photo, AI output, score breakdown, actions"
        bodyClassName="flex flex-col gap-5 p-4"
        actions={<PriorityBadge band={detail.priority?.band} score={detail.priority?.score} overridden={detail.priority?.overridden} />}
      >
        <div className="flex flex-col gap-4 md:flex-row">
          {detail.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img src={detail.photoUrl} alt="Report photo" className="h-44 w-full border border-line object-cover md:w-56" />
          ) : (
            <div className="flex h-44 w-full shrink-0 flex-col items-center justify-center gap-1 border border-dashed border-muted text-muted md:w-56">
              <CameraIcon />
              <span className="font-mono text-[10px]">no photo</span>
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-3">
              <PriorityCircle band={detail.priority?.band} size="lg" />
              <div>
                <p className="font-mono text-lg font-bold">{detail.trackingCode}</p>
                <p className="text-xs text-muted">
                  {detail.location.area ?? "Unknown area"} · {detail.location.lat}, {detail.location.lng} ·{" "}
                  <a href={`https://www.openstreetmap.org/?mlat=${detail.location.lat}&mlon=${detail.location.lng}#map=17/${detail.location.lat}/${detail.location.lng}`} target="_blank" rel="noreferrer" className="underline">open map</a>
                </p>
              </div>
            </div>
            <p className="text-sm">{detail.description || <em className="text-muted">No description</em>}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Tag>{detail.incidentType?.replace("_", " ") ?? "Type unconfirmed"}</Tag>
              {detail.severity ? <SeverityChip severity={detail.severity} /> : <Tag className="border-dashed text-muted">Severity unconfirmed</Tag>}
              {latest && <Tag>Conf {Math.round(latest.confidence * 100)}%</Tag>}
            </div>
            {hazards.length > 0 && <p className="text-xs text-muted">Hazards: {hazards.join(", ")}</p>}
            <p className="font-mono text-[10px] text-muted">
              Reported {new Date(detail.createdAt).toLocaleString()} · Team: {currentTeam?.name ?? "none"}
            </p>
          </div>
        </div>

        {/* Where the incident is in the workflow, and the one action that moves it forward. */}
        <section className="border-2 border-line">
          <ol className="grid grid-cols-5 border-b border-line">
            {WORKFLOW.map((w, i) => (
              <li
                key={w.key}
                className={`px-2 py-1.5 text-center font-mono text-[9px] uppercase tracking-wide ${i > 0 ? "border-l border-line" : ""} ${i === stepIndex ? "bg-foreground font-bold text-background" : i < stepIndex ? "" : "text-muted"}`}
              >
                {w.label}
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3 p-3">
            <p className="font-mono text-xs font-bold uppercase tracking-wider">
              {detail.status === "rejected" ? "Rejected" : `Next step: ${step?.next ?? detail.status}`}
              {step && detail.status !== "rejected" && <span className="ml-2 font-normal normal-case tracking-normal text-muted">by {step.actor.toLowerCase()}</span>}
            </p>
            <p className="text-sm text-muted">
              {detail.status === "rejected" ? "This report was marked as not a real incident. No further action." : step?.explain}
            </p>

            {step?.key === "review" && (
              <ReviewForm bare item={{ id: detail.id, description: detail.description, photoUrl: detail.photoUrl, classification: latest ?? null }} onDone={() => void load()} />
            )}

            {step?.key === "assign" &&
              (isAdmin ? assignForm("Assign team") : <p className="font-mono text-[11px]">Waiting for an admin to assign a team.</p>)}

            {(step?.key === "respond" || step?.key === "done") && (
              <div className="flex flex-wrap items-center gap-2">
                {transitions.map((s) => (
                  <Button
                    key={s}
                    variant={s === "resolved" || s === "in_progress" ? "primary" : "secondary"}
                    disabled={busy || (!isAdmin && !onTeam)}
                    onClick={() => act(transitionLabel(s), `/api/incidents/${id}/status`, "PATCH", { status: s })}
                    className={small}
                  >
                    {transitionLabel(s)}
                  </Button>
                ))}
                {!isAdmin && !onTeam && <span className="font-mono text-[10px] text-muted">Only {currentTeam?.name ?? "the assigned team"} or an admin can update this.</span>}
              </div>
            )}
          </div>
        </section>

        <ErrorText>{error}</ErrorText>
        {message && <p className="font-mono text-xs">{message}</p>}

        {/* AI suggestion next to the human decision, so it's clear who decided what. */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="border border-line p-3">
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider">AI suggested</p>
            {latest ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag>{latest.incidentType.replace("_", " ")}</Tag>
                  <SeverityChip severity={latest.severity} />
                  <Tag>Conf {Math.round(latest.confidence * 100)}%</Tag>
                  {latest.hoaxSuspected && <Tag className="bg-foreground text-background">Possible hoax</Tag>}
                </div>
                {latest.hoaxSuspected && (
                  <p className="mt-2 text-xs">
                    The AI saw signs this may not be a genuine report. It is never rejected automatically; check the photo and description before confirming.
                  </p>
                )}
                <p className="mt-2 font-mono text-[10px] text-muted">{latest.model}{latest.latencyMs ? ` · ${(latest.latencyMs / 1000).toFixed(1)} s` : ""}</p>
              </>
            ) : (
              <p className="font-mono text-[11px] text-muted">no AI result yet</p>
            )}
          </div>
          <div className="border border-line p-3">
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider">Human decision</p>
            {detail.review ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag>{detail.review.finalType.replace("_", " ")}</Tag>
                  <SeverityChip severity={detail.review.finalSeverity as Severity} />
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted">
                  by {detail.review.reviewer?.full_name ?? "staff"} · {new Date(detail.review.createdAt).toLocaleString()}
                  {detail.review.notes && ` · "${detail.review.notes}"`}
                </p>
              </>
            ) : detail.status === "pending_review" ? (
              <p className="font-mono text-[11px] text-muted">waiting for review (see next step above)</p>
            ) : detail.status === "received" ? (
              <p className="font-mono text-[11px] text-muted">not needed yet</p>
            ) : (
              <p className="font-mono text-[11px] text-muted">not needed: the AI was confident and rated it low/moderate, so its answer was used directly</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] text-muted">
            Priority score {detail.priority ? `· total ${detail.priority.score} / 100` : "· not scored yet (scored after the type and severity are confirmed)"}
          </p>
          {BARS.map(({ key, label }) => {
            const value = detail.priority?.breakdown[key] ?? 0;
            const max = PRIORITY_WEIGHTS[key] * 100;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 font-mono text-[11px] text-muted">{label}</span>
                <span className="relative h-3 flex-1 border border-line" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
                  <span className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[11px]">{value} / {max}</span>
              </div>
            );
          })}
        </div>

        {/* Less common admin actions, kept apart from the main next step. */}
        {isAdmin ? (
          <details className="border border-line">
            <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider">Admin tools</summary>
            <div className="flex flex-col gap-4 border-t border-line p-3">
              {canAssign && detail.status !== "classified" && (
                <div className="flex flex-col gap-1">
                  <p className="font-mono text-[10px] text-muted">Reassign to a different team (history is kept).</p>
                  {assignForm("Reassign team")}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[10px] text-muted">Override the priority score when local knowledge says the formula is wrong. A reason is required and logged.</p>
                {overrideOpen ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-28">
                      <Field label="Score (0–100)">
                        <input value={score} onChange={(e) => setScore(e.target.value)} inputMode="decimal" className={inputClass} />
                      </Field>
                    </div>
                    <div className="min-w-48 flex-1">
                      <Field label="Reason">
                        <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
                      </Field>
                    </div>
                    <Button disabled={busy || !score || !reason} onClick={() => act("Priority override", `/api/incidents/${id}/priority`, "PATCH", { score: Number(score), reason })}>Save</Button>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setOverrideOpen(true)} className={`${small} self-start`}>Override score</Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => act("Re-run AI", `/api/incidents/${id}/reclassify`, "POST")} className={small}>
                  Re-run AI
                </Button>
                <span className="font-mono text-[10px] text-muted">uses one AI call</span>
                {canReject && (
                  <Button variant="danger" disabled={busy} onClick={() => act("Reject incident", `/api/incidents/${id}/status`, "PATCH", { status: "rejected" })} className={`${small} ml-auto`}>
                    Reject incident
                  </Button>
                )}
              </div>
            </div>
          </details>
        ) : (
          <p className="font-mono text-[10px] text-muted">Assigning teams, score overrides, re-running the AI and rejecting are admin-only.</p>
        )}
      </Panel>

      <Panel title="Assignment history" bodyClassName="p-3">
        {detail.assignments.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {detail.assignments.map((a) => (
              <li key={a.id}>{a.team?.name ?? "Unknown team"} <span className="font-mono text-[10px] text-muted">{new Date(a.assignedAt).toLocaleString()}</span></li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-[11px] text-muted">no team assigned yet</p>
        )}
      </Panel>

      <Panel title={`AI classifications (${detail.classifications.length})`} bodyClassName="overflow-x-auto p-3">
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[10px] uppercase text-muted">
            <tr><th className="pb-2 pr-3">When</th><th className="pb-2 pr-3">Model / step</th><th className="pb-2 pr-3">Type</th><th className="pb-2 pr-3">Severity</th><th className="pb-2 pr-3">Conf</th><th className="pb-2">Hazards</th></tr>
          </thead>
          <tbody>
            {detail.classifications.map((c) => (
              <tr key={c.id} className="border-t border-faint">
                <td className="whitespace-nowrap py-1.5 pr-3 text-xs">{new Date(c.createdAt).toLocaleString()}</td>
                <td className="pr-3 font-mono text-[11px]">{c.model}</td>
                <td className="pr-3">{c.incidentType}</td>
                <td className="pr-3"><SeverityChip severity={c.severity} /></td>
                <td className="pr-3 font-mono text-xs">{Math.round(c.confidence * 100)}%</td>
                <td className="text-xs">{c.hazards.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title={`Audit log (${detail.auditLog.length})`} bodyClassName="p-3">
        <ul className="flex flex-col gap-2">
          {detail.auditLog.map((l) => (
            <li key={l.id}>
              <details>
                <summary className="cursor-pointer text-sm">
                  <span className="font-mono text-xs">{l.action}</span> <span className="font-mono text-[10px] text-muted">{new Date(l.createdAt).toLocaleString()}</span>
                </summary>
                <Json value={{ before: l.before, after: l.after, actorId: l.actorId }} />
              </details>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
