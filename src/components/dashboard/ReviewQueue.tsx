"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, ErrorText, Field, inputClass, Pill } from "@/components/ui/basics";
import { SeverityChip } from "@/components/ui/SeverityChip";
import { api } from "@/lib/api-client";
import { INCIDENT_TYPES, SEVERITY } from "@/lib/constants";
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
  classification: { model: string; incidentType: string; severity: Severity; confidence: number; hazards: string[] } | null;
}

export function ReviewQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    void api<{ items: QueueItem[] }>("/api/review-queue").then((res) => {
      setLoading(false);
      if (!res.ok) return setError(res.error);
      setError(null);
      setItems(res.data.items);
    });
  }, [reload]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="opacity-70">{items.length} waiting</span>
        <button onClick={() => setReload((n) => n + 1)} className="underline">Refresh</button>
      </div>
      <ErrorText>{error}</ErrorText>
      {!loading && items.length === 0 && <p className="opacity-60">Nothing to review.</p>}
      {items.map((item) => (
        <ReviewCard key={item.id} item={item} onDone={() => setItems((all) => all.filter((i) => i.id !== item.id))} />
      ))}
    </div>
  );
}

function ReviewCard({ item, onDone }: { item: QueueItem; onDone: () => void }) {
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
    <Card className={`flex flex-col gap-3 md:flex-row ${item.urgentUnverified ? "border-sev-critical" : ""}`}>
      {item.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={item.photoUrl} alt="Report photo" className="h-48 w-full rounded-md object-cover md:w-64" />
      ) : (
        <div className="flex h-48 w-full items-center justify-center rounded-md bg-black/5 text-sm opacity-60 md:w-64 dark:bg-white/10">No photo</div>
      )}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/incidents/${item.id}`} className="font-mono font-bold underline">{item.trackingCode}</Link>
          {item.urgentUnverified && <Pill className="bg-sev-critical text-white">Urgent · no AI check</Pill>}
          {item.keywordOnly && !item.urgentUnverified && <Pill>Keyword guess only</Pill>}
          {item.stuck && <Pill className="bg-sev-moderate/30">Stuck in received</Pill>}
          <span className="text-xs opacity-60">{item.area ?? "Unknown area"} · {new Date(item.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-sm">{item.description || <em className="opacity-60">No description</em>}</p>
        {c ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="opacity-60">AI:</span> {c.incidentType} <SeverityChip severity={c.severity} />
            <span>confidence {Math.round(c.confidence * 100)}%</span>
            <span className="text-xs opacity-60">{c.model}</span>
            {c.hazards.length > 0 && <span className="text-xs opacity-70">hazards: {c.hazards.join(", ")}</span>}
          </p>
        ) : (
          <p className="text-sm opacity-60">No classification yet.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Final type">
            <select value={finalType} onChange={(e) => setFinalType(e.target.value)} className={inputClass}>
              {INCIDENT_TYPES.map((t) => <option key={t}>{t}</option>)}
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
        {result && <p className="text-sm text-sev-low">{result}</p>}
        <div className="flex gap-2">
          <Button disabled={busy || !!result} onClick={() => send({ finalType, finalSeverity, notes })}>Confirm</Button>
          <Button variant="danger" disabled={busy || !!result} onClick={() => send({ reject: true, notes })}>Reject</Button>
        </div>
      </div>
    </Card>
  );
}
