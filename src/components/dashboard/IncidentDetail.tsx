"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStaff } from "@/components/dashboard/StaffProvider";
import { Button, CameraIcon, ErrorText, Field, inputClass, Json, Panel, PriorityBadge, PriorityCircle, StatusPill, Tag } from "@/components/ui/basics";
import { SeverityChip } from "@/components/ui/SeverityChip";
import { api } from "@/lib/api-client";
import { PRIORITY_WEIGHTS, STATUS_TRANSITIONS } from "@/lib/constants";
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
  classifications: { id: string; model: string; incidentType: string; severity: Severity; confidence: number; hazards: string[]; latencyMs: number | null; createdAt: string }[];
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

export function IncidentDetail({ id }: { id: string }) {
  const staff = useStaff();
  const isAdmin = staff?.role === "admin";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"assign" | "override" | null>(null);
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
    setPanel(null);
    await load();
  }

  if (!detail) return error ? <ErrorText>{error}</ErrorText> : <p className="font-mono text-xs text-muted">Loading...</p>;

  const transitions = STATUS_TRANSITIONS[detail.status] ?? [];
  const currentTeam = teams.find((t) => t.id === detail.teamId);
  const onTeam = !!detail.teamId && detail.teamId === staff?.teamId;
  const latest = detail.classifications[0];
  const hazards = latest?.hazards ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/dashboard" className="font-mono text-[11px] uppercase underline">← Ranked list</Link>

      <Panel
        title="Incident detail"
        hint="photo, AI output, score breakdown, actions"
        bodyClassName="flex flex-col gap-5 p-4"
        actions={
          <>
            <StatusPill status={detail.status} />
            <PriorityBadge band={detail.priority?.band} score={detail.priority?.score} overridden={detail.priority?.overridden} />
          </>
        }
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

        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] text-muted">
            Score breakdown {detail.priority ? `· total ${detail.priority.score} / 100` : "· not scored yet (needs a confirmed type and severity)"}
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

        <ErrorText>{error}</ErrorText>
        {message && <p className="font-mono text-xs">{message}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Button disabled={!isAdmin} onClick={() => setPanel(panel === "assign" ? null : "assign")} title={isAdmin ? undefined : "Admin only"}>
            Assign team
          </Button>
          <Button variant="secondary" disabled={!isAdmin} onClick={() => setPanel(panel === "override" ? null : "override")} title={isAdmin ? undefined : "Admin only"}>
            Override score
          </Button>
        </div>
        {!isAdmin && <p className="-mt-3 font-mono text-[10px] text-muted">Assigning, score overrides and re-running the AI are admin-only.</p>}

        {panel === "assign" && (
          <div className="flex flex-wrap items-end gap-2 border border-line p-3">
            <div className="min-w-48 flex-1">
              <Field label="Team">
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputClass}>
                  <option value="">Choose team</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </div>
            <Button disabled={busy || !teamId} onClick={() => act("Assign", `/api/incidents/${id}/assign`, "POST", { teamId })}>Assign</Button>
          </div>
        )}
        {panel === "override" && (
          <div className="flex flex-wrap items-end gap-2 border border-line p-3">
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
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-faint pt-4">
          <span className="font-mono text-[11px] text-muted">Status:</span>
          {transitions.length === 0 && <span className="font-mono text-[11px] text-muted">no changes available</span>}
          {transitions.map((s) => (
            <Button
              key={s}
              variant={s === "rejected" ? "danger" : "secondary"}
              disabled={busy || (!isAdmin && (!onTeam || s === "rejected"))}
              title={!isAdmin && !onTeam ? "Only the assigned team or an admin" : undefined}
              onClick={() => act(`Status → ${s}`, `/api/incidents/${id}/status`, "PATCH", { status: s })}
              className="px-3 py-1.5"
            >
              → {s.replace("_", " ")}
            </Button>
          ))}
          {isAdmin && (
            <Button variant="secondary" disabled={busy} onClick={() => act("Reclassify", `/api/incidents/${id}/reclassify`, "POST")} className="ml-auto px-3 py-1.5">
              Re-run AI
            </Button>
          )}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Human review" bodyClassName="p-3">
          {detail.review ? (
            <p className="text-sm">
              {detail.review.finalType} / {detail.review.finalSeverity} by {detail.review.reviewer?.full_name ?? "staff"} ·{" "}
              {new Date(detail.review.createdAt).toLocaleString()} {detail.review.notes && `· "${detail.review.notes}"`}
            </p>
          ) : (
            <p className="font-mono text-[11px] text-muted">not reviewed</p>
          )}
        </Panel>
        <Panel title="Assignments" bodyClassName="p-3">
          {detail.assignments.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {detail.assignments.map((a) => (
                <li key={a.id}>{a.team?.name ?? "Unknown team"} <span className="font-mono text-[10px] text-muted">{new Date(a.assignedAt).toLocaleString()}</span></li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-[11px] text-muted">no team assigned</p>
          )}
        </Panel>
      </div>

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
