"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IncidentMap } from "@/components/dashboard/IncidentMap";
import { ErrorText, Panel, PriorityCircle, Tag } from "@/components/ui/basics";
import { SeverityChip } from "@/components/ui/SeverityChip";
import { api } from "@/lib/api-client";
import { INCIDENT_TYPES, REPORT_STATUSES } from "@/lib/constants";
import type { Severity } from "@/types";

interface Incident {
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

const selectClass = "border border-line bg-background px-2 py-1 font-mono text-[11px] uppercase";

/** Priority-ranked incident list with the severity map beside it. */
export function IncidentList() {
  const [status, setStatus] = useState("");
  const [band, setBand] = useState("");
  const [type, setType] = useState("");
  const [items, setItems] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (band) params.set("band", band);
    if (type) params.set("type", type);
    let cancelled = false;
    void api<{ items: Incident[]; total: number }>(`/api/incidents?${params}`).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) return setError(res.error);
      setError(null);
      setItems(res.data.items);
      setTotal(res.data.total);
    });
    return () => { cancelled = true; };
  }, [status, band, type, reload]);

  return (
    <Panel
      title="Dashboard — ranked incidents + map"
      hint="priority-ranked list, live map"
      bodyClassName="grid lg:grid-cols-2"
      actions={
        <>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Status">
            <option value="">Open</option>
            {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select value={band} onChange={(e) => setBand(e.target.value)} className={selectClass} aria-label="Band">
            <option value="">All bands</option>
            {["P1", "P2", "P3", "P4"].map((b) => <option key={b}>{b}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass} aria-label="Type">
            <option value="">All types</option>
            {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <button onClick={() => setReload((n) => n + 1)} className="font-mono text-[11px] uppercase underline">Refresh</button>
          <span className="font-mono text-[11px] text-muted">{total} total</span>
        </>
      }
    >
      <div className="border-b border-line lg:border-b-0 lg:border-r">
        <ErrorText>{error}</ErrorText>
        <ul className="max-h-[32rem] overflow-y-auto px-3">
          {items.map((i) => (
            <li key={i.id} className="border-b border-faint last:border-b-0">
              <Link href={`/dashboard/incidents/${i.id}`} className="flex items-center gap-3 py-3 hover:bg-grid/60">
                <PriorityCircle band={i.priority?.band} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="capitalize">{i.incidentType?.replace("_", " ") ?? "Unconfirmed"}</span>
                    {i.severity && <SeverityChip severity={i.severity} />}
                    <span className="font-mono text-[11px] text-muted">{i.trackingCode}</span>
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {i.location.area ?? "Unknown area"} · {i.description || "no description"} · {new Date(i.createdAt).toLocaleString()}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {i.status === "pending_review" ? <Tag>Review</Tag> : <Tag className="border-faint text-muted">{i.status.replace("_", " ")}</Tag>}
                  {i.priority && <span className="font-mono text-[10px] text-muted">{i.priority.score}{i.priority.overridden ? " · override" : ""}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {!loading && items.length === 0 && <p className="py-10 text-center font-mono text-[11px] text-muted">no incidents match</p>}
        {loading && <p className="py-10 text-center font-mono text-[11px] text-muted">loading...</p>}
      </div>
      <IncidentMap reload={reload} />
    </Panel>
  );
}
