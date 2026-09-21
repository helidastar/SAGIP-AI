"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorText, inputClass, PriorityBadge, StatusPill } from "@/components/ui/basics";
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto`} aria-label="Status">
          <option value="">Open (default)</option>
          {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={band} onChange={(e) => setBand(e.target.value)} className={`${inputClass} w-auto`} aria-label="Band">
          <option value="">All bands</option>
          {["P1", "P2", "P3", "P4"].map((b) => <option key={b}>{b}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputClass} w-auto`} aria-label="Type">
          <option value="">All types</option>
          {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setReload((n) => n + 1)} className="text-sm underline">Refresh</button>
        <a href="/api/incidents/map" target="_blank" className="text-sm underline">Map GeoJSON</a>
        <span className="ml-auto text-sm opacity-70">{total} incidents</span>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/10 text-xs uppercase opacity-60 dark:border-white/15">
            <tr>
              <th className="py-2 pr-3">Priority</th>
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Severity</th>
              <th className="py-2 pr-3">Area</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2">Reported</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-black/5 align-top dark:border-white/10">
                <td className="py-2 pr-3"><PriorityBadge band={i.priority?.band} score={i.priority?.score} overridden={i.priority?.overridden} /></td>
                <td className="py-2 pr-3 font-mono"><Link href={`/dashboard/incidents/${i.id}`} className="underline">{i.trackingCode}</Link></td>
                <td className="py-2 pr-3"><StatusPill status={i.status} /></td>
                <td className="py-2 pr-3">{i.incidentType ?? "—"}</td>
                <td className="py-2 pr-3">{i.severity ? <SeverityChip severity={i.severity} /> : "—"}</td>
                <td className="py-2 pr-3">{i.location.area ?? "—"}</td>
                <td className="max-w-xs truncate py-2 pr-3">{i.description || "—"}</td>
                <td className="whitespace-nowrap py-2 text-xs opacity-70">{new Date(i.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <p className="py-6 text-center text-sm opacity-60">No incidents match.</p>}
      </div>
    </div>
  );
}
