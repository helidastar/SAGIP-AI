"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, CameraIcon, ErrorText, Field, inputClass, Tag } from "@/components/ui/basics";
import { SeverityChip } from "@/components/ui/SeverityChip";
import { api } from "@/lib/api-client";
import { CONFIDENCE_THRESHOLD, INCIDENT_TYPES, SEVERITY } from "@/lib/constants";
import type { Severity } from "@/types";

interface QueueItem {
  id: string;
  trackingCode: string;
  description: string;
  photoUrl: string | null;
  area: string | null;
  status: string;
  stuck: boolean;
  keywordOnly: boolean;
  urgentUnverified: boolean;
  createdAt: string;
  classification: { model: string; incidentType: string; severity: Severity; confidence: number; hazards: string[]; hoaxSuspected?: boolean } | null;
}

type QueueLoadResult =
  | { reload: number; state: "ready"; items: QueueItem[] }
  | { reload: number; state: "error"; error: string };

/** Why a report is in the queue, as the sketch's tags: CRITICAL, HIGH, LOW CONF, etc. */
function flags(item: QueueItem) {
  const c = item.classification;
  const out: { label: string; strong?: boolean }[] = [];
  // A suspected hoax is the first thing a reviewer should see.
  if (c?.hoaxSuspected) out.push({ label: "Possible hoax", strong: true });
  if (item.urgentUnverified) out.push({ label: "Urgent · no AI", strong: true });
  if (c?.severity === "critical") out.push({ label: "Critical", strong: true });
  else if (c?.severity === "high") out.push({ label: "High" });
  if (item.keywordOnly && !item.urgentUnverified) out.push({ label: "Keyword only" });
  else if (c && c.confidence < CONFIDENCE_THRESHOLD) out.push({ label: "Low conf" });
  if (item.stuck) out.push({ label: "Stuck" });
  if (!c) out.push({ label: "No AI" });
  return out;
}

/** Full review queue, or with `compact` a short preview that links to it (dashboard home). */
export function ReviewQueue({ compact = false }: { compact?: boolean }) {
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [loadResult, setLoadResult] = useState<QueueLoadResult | null>(null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api<{ items: QueueItem[] }>("/api/review-queue").then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLoadResult({
          reload,
          state: "error",
          error: res.error ?? "Could not load review queue",
        });
        return;
      }
      setLoadResult({ reload, state: "ready", items: res.data.items });
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const currentResult = loadResult?.reload === reload ? loadResult : null;
  const loading = currentResult === null;
  const error = currentResult?.state === "error" ? currentResult.error : null;
  const items = currentResult?.state === "ready"
    ? currentResult.items.filter((item) => !removedIds.includes(item.id))
    : [];
  const shown = compact ? items.slice(0, 5) : items;

  return (
    <section className="dashboard-review-panel" aria-labelledby="review-queue-title" aria-busy={loading}>
      <header className="dashboard-review-heading">
        <div>
          <h2 id="review-queue-title">Review Queue</h2>
          <p>Low confidence / high severity, awaiting confirmation</p>
        </div>
        <span className="dashboard-review-actions">
          <span className="dashboard-review-count">
            {loading ? "Loading" : error ? "Unavailable" : `${items.length} waiting`}
          </span>
          {compact ? (
            <Link href="/dashboard/review" className="dashboard-text-link">Open queue</Link>
          ) : (
            <button type="button" onClick={() => setReload((n) => n + 1)} className="dashboard-text-link">Refresh</button>
          )}
        </span>
      </header>
      <div className="dashboard-review-body">
        {error && <p role="alert" className="dashboard-inline-error">{error}</p>}
        {!loading && !error && items.length === 0 && <p className="dashboard-review-empty">Nothing to review</p>}
        {loading && <p className="dashboard-review-loading" aria-busy="true">Loading review queue...</p>}
        <ul className="dashboard-review-list">
          {shown.map((item) => {
            const isOpen = !compact && open === item.id;
            const c = item.classification;
            const row = (
              <>
                <span className={`h-5 w-5 shrink-0 border border-line ${isOpen ? "bg-foreground" : ""}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="capitalize">{c?.incidentType.replace("_", " ") ?? "Unclassified"}</span>
                    <span className="font-mono text-[11px] text-muted">{item.trackingCode}</span>
                    {c && <span className="font-mono text-[11px] text-muted">conf {Math.round(c.confidence * 100)}%</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {item.area ?? "Unknown area"} · {item.description || "no description"} · {new Date(item.createdAt).toLocaleString()}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {flags(item).map((f) => (
                    <Tag key={f.label} className={f.strong ? "bg-foreground text-background" : ""}>{f.label}</Tag>
                  ))}
                </span>
              </>
            );
            return (
              <li key={item.id} className="dashboard-review-row">
                {compact ? (
                  <Link href="/dashboard/review" className="dashboard-review-row-link">{row}</Link>
                ) : (
                  <button type="button" onClick={() => setOpen(isOpen ? null : item.id)} aria-expanded={isOpen} className="dashboard-review-row-link">
                    {row}
                  </button>
                )}
                {isOpen && (
                  <ReviewForm
                    item={item}
                    onDone={() => {
                      setOpen(null);
                      setRemovedIds((ids) => [...ids, item.id]);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {compact && items.length > shown.length && (
          <p className="dashboard-review-more">+{items.length - shown.length} more in the queue</p>
        )}
      </div>
    </section>
  );
}

type ReviewTarget = Pick<QueueItem, "id" | "description" | "photoUrl" | "classification">;

/** Confirm/correct or reject a flagged report. `bare` hides the photo and description (for the incident page). */
export function ReviewForm({ item, onDone, bare = false }: { item: ReviewTarget; onDone: () => void; bare?: boolean }) {
  const c = item.classification;
  const [finalType, setFinalType] = useState(c?.incidentType ?? "other");
  const [finalSeverity, setFinalSeverity] = useState<string>(c?.severity ?? "moderate");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function send(body: object) {
    setBusy(true);
    const res = await api<{ status: string; priority: { band: string; score: number } | null }>(`/api/reports/${item.id}/review`, { method: "POST", json: body });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setResult(`Saved: ${res.data.status}${res.data.priority ? ` · ${res.data.priority.band} (${res.data.priority.score})` : ""}`);
    setTimeout(onDone, 1500);
  }

  return (
    <div className={`dashboard-review-form ${bare ? "flex flex-col gap-3" : "mb-3 flex flex-col gap-3 border border-line p-3 md:flex-row"}`}>
      {bare ? null : item.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={item.photoUrl} alt="Report photo" className="h-48 w-full border border-faint object-cover md:w-64" />
      ) : (
        <div className="flex h-48 w-full flex-col items-center justify-center gap-1 border border-dashed border-muted text-muted md:w-64">
          <CameraIcon />
          <span className="font-mono text-[10px]">no photo</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3">
        {!bare && <p className="text-sm">{item.description || <em className="text-muted">No description</em>}</p>}
        {bare ? null : c ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-[11px] text-muted">AI:</span>
            <Tag>{c.incidentType.replace("_", " ")}</Tag>
            <SeverityChip severity={c.severity} />
            <Tag>Conf {Math.round(c.confidence * 100)}%</Tag>
            {c.hoaxSuspected && <Tag className="bg-foreground text-background">Possible hoax</Tag>}
            <span className="font-mono text-[10px] text-muted">{c.model}</span>
          </p>
        ) : (
          <p className="font-mono text-[11px] text-muted">no classification yet</p>
        )}
        {!bare && c && c.hazards.length > 0 && <p className="text-xs text-muted">Hazards: {c.hazards.join(", ")}</p>}
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Final type">
            <select value={finalType} onChange={(e) => setFinalType(e.target.value)} className={inputClass}>
              {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Final severity">
            <select value={finalSeverity} onChange={(e) => setFinalSeverity(e.target.value)} className={inputClass}>
              {Object.keys(SEVERITY).map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        {result && <p className="font-mono text-xs">{result}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !!result} onClick={() => send({ finalType, finalSeverity, notes })}>Confirm and rank</Button>
          <Button variant="danger" disabled={busy || !!result} onClick={() => send({ reject: true, notes })}>Reject</Button>
          {!bare && <Link href={`/dashboard/incidents/${item.id}`} className="ml-auto self-center font-mono text-[11px] uppercase underline">Full detail</Link>}
        </div>
      </div>
    </div>
  );
}
