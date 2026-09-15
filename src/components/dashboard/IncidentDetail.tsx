"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStaff } from "@/components/dashboard/StaffProvider";
import { Button, Card, ErrorText, Field, inputClass, Json, PriorityBadge, StatusPill } from "@/components/ui/basics";
import { SeverityChip } from "@/components/ui/SeverityChip";
import { api } from "@/lib/api-client";
import { STATUS_TRANSITIONS } from "@/lib/constants";
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

export function IncidentDetail({ id }: { id: string }) {
  const staff = useStaff();
  const isAdmin = staff?.role === "admin";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    await load();
  }

  if (!detail) return error ? <ErrorText>{error}</ErrorText> : <p className="opacity-60">Loading...</p>;

  const transitions = STATUS_TRANSITIONS[detail.status] ?? [];
  const currentTeam = teams.find((t) => t.id === detail.teamId);
  const onTeam = !!detail.teamId && detail.teamId === staff?.teamId;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard" className="text-sm underline">← All incidents</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold">{detail.trackingCode}</h1>
        <StatusPill status={detail.status} />
        <PriorityBadge band={detail.priority?.band} score={detail.priority?.score} overridden={detail.priority?.overridden} />
      </div>
      <ErrorText>{error}</ErrorText>
      {message && <p className="text-sm text-sev-low">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          {detail.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img src={detail.photoUrl} alt="Report photo" className="max-h-80 w-full rounded-md object-contain" />
          ) : (
            <p className="text-sm opacity-60">No photo</p>
          )}
          <p>{detail.description || <em className="opacity-60">No description</em>}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span>{detail.incidentType ?? "Unconfirmed type"}</span>
            {detail.severity && <SeverityChip severity={detail.severity} />}
          </p>
          <p className="text-sm opacity-70">
            {detail.location.area ?? "Unknown area"} · {detail.location.lat}, {detail.location.lng} ·{" "}
            <a href={`https://www.openstreetmap.org/?mlat=${detail.location.lat}&mlon=${detail.location.lng}#map=17/${detail.location.lat}/${detail.location.lng}`} target="_blank" rel="noreferrer" className="underline">map</a>
          </p>
          <p className="text-xs opacity-60">Reported {new Date(detail.createdAt).toLocaleString()} · Team: {currentTeam?.name ?? "none"}</p>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">Actions</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm opacity-70">Status:</span>
            {transitions.length === 0 && <span className="text-sm opacity-60">no changes available</span>}
            {transitions.map((s) => (
              <Button
                key={s}
                variant={s === "rejected" ? "danger" : "secondary"}
                disabled={busy || (!isAdmin && (!onTeam || s === "rejected"))}
                title={!isAdmin && !onTeam ? "Only the assigned team or an admin" : undefined}
                onClick={() => act(`Status → ${s}`, `/api/incidents/${id}/status`, "PATCH", { status: s })}
              >
                → {s}
              </Button>
            ))}
          </div>
          {isAdmin ? (
            <>
              <div className="flex items-end gap-2">
                <Field label="Assign team">
                  <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputClass}>
                    <option value="">Choose team</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
                <Button disabled={busy || !teamId} onClick={() => act("Assign", `/api/incidents/${id}/assign`, "POST", { teamId })}>Assign</Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Override score (0–100)">
                  <input value={score} onChange={(e) => setScore(e.target.value)} inputMode="decimal" className={`${inputClass} w-28`} />
                </Field>
                <Field label="Reason">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
                </Field>
                <Button disabled={busy || !score || !reason} onClick={() => act("Priority override", `/api/incidents/${id}/priority`, "PATCH", { score: Number(score), reason })}>Override</Button>
              </div>
              <Button variant="secondary" disabled={busy} onClick={() => act("Reclassify", `/api/incidents/${id}/reclassify`, "POST")}>
                Re-run AI classification
              </Button>
            </>
          ) : (
            <p className="text-xs opacity-60">Assigning, priority overrides and re-classification are admin-only.</p>
          )}
        </Card>
      </div>

      {detail.priority && (
        <Card>
          <h2 className="mb-2 font-semibold">Priority breakdown</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {Object.entries(detail.priority.breakdown).map(([k, v]) => <span key={k}>{k}: <strong>{v}</strong></span>)}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Review</h2>
        {detail.review ? (
          <p className="text-sm">
            {detail.review.finalType} / {detail.review.finalSeverity} by {detail.review.reviewer?.full_name ?? "staff"} ·{" "}
            {new Date(detail.review.createdAt).toLocaleString()} {detail.review.notes && `· "${detail.review.notes}"`}
          </p>
        ) : (
          <p className="text-sm opacity-60">Not reviewed.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">AI classifications ({detail.classifications.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase opacity-60">
              <tr><th className="pr-3">When</th><th className="pr-3">Model / step</th><th className="pr-3">Type</th><th className="pr-3">Severity</th><th className="pr-3">Confidence</th><th>Hazards</th></tr>
            </thead>
            <tbody>
              {detail.classifications.map((c) => (
                <tr key={c.id} className="border-t border-black/5 dark:border-white/10">
                  <td className="whitespace-nowrap py-1 pr-3 text-xs">{new Date(c.createdAt).toLocaleString()}</td>
                  <td className="pr-3 font-mono text-xs">{c.model}</td>
                  <td className="pr-3">{c.incidentType}</td>
                  <td className="pr-3"><SeverityChip severity={c.severity} /></td>
                  <td className="pr-3">{Math.round(c.confidence * 100)}%</td>
                  <td className="text-xs">{c.hazards.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Audit log ({detail.auditLog.length})</h2>
        <ul className="flex flex-col gap-2">
          {detail.auditLog.map((l) => (
            <li key={l.id}>
              <details>
                <summary className="cursor-pointer text-sm">
                  <span className="font-mono">{l.action}</span> <span className="text-xs opacity-60">{new Date(l.createdAt).toLocaleString()}</span>
                </summary>
                <Json value={{ before: l.before, after: l.after, actorId: l.actorId }} />
              </details>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
