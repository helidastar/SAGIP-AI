"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ErrorText, Hint, inputClass, Panel } from "@/components/ui/basics";
import { api } from "@/lib/api-client";

interface Tracked {
  trackingCode: string;
  status: string;
  publicStatus: string;
  incidentType: string | null;
  updatedAt: string;
}

/** The four citizen-facing steps, and which internal statuses belong to each. */
const TIMELINE = [
  { label: "Received", statuses: ["received"] },
  { label: "Under review", statuses: ["pending_review", "classified"] },
  { label: "Responder assigned", statuses: ["assigned", "in_progress"] },
  { label: "Resolved", statuses: ["resolved"] },
];

export function TrackReport({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [report, setReport] = useState<Tracked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Returns a promise and only sets state after it resolves, so it's safe to call from effects.
  const lookup = useCallback(
    (value: string) =>
      api<Tracked>(`/api/reports/track/${encodeURIComponent(value.trim())}`).then((res) => {
        setLoading(false);
        if (!res.ok) {
          setReport(null);
          return setError(res.error);
        }
        setError(null);
        setReport(res.data);
      }),
    [],
  );

  useEffect(() => {
    if (initialCode) void lookup(initialCode);
  }, [initialCode, lookup]);

  // While the AI is still working, refresh every 3 seconds.
  useEffect(() => {
    if (report?.status !== "received") return;
    const timer = setInterval(() => void lookup(report.trackingCode), 3000);
    return () => clearInterval(timer);
  }, [report, lookup]);

  const current = report ? TIMELINE.findIndex((s) => s.statuses.includes(report.status)) : -1;
  const closed = report?.status === "rejected";

  return (
    <Panel title="Track report" step="3/3" bodyClassName="flex flex-col gap-3 p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          void lookup(code);
        }}
        className="flex gap-2"
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SGP-XXXXXX" aria-label="Tracking code" className={`${inputClass} font-mono uppercase`} />
        <Button type="submit" disabled={loading || !code.trim()}>Go</Button>
      </form>
      <Hint>tracking code input</Hint>
      <ErrorText>{error}</ErrorText>

      {report && (
        <>
          <div className="border-b border-faint pb-3">
            <p className="font-mono text-sm font-bold">{report.trackingCode}</p>
            <p className="text-base">{report.publicStatus}</p>
            {report.incidentType && <p className="font-mono text-[11px] text-muted">type: {report.incidentType.replace("_", " ")}</p>}
          </div>

          <Hint>status timeline</Hint>
          {closed ? (
            <p className="border border-line px-3 py-2 font-mono text-xs uppercase">Closed by responders</p>
          ) : (
            <ol className="flex flex-col">
              {TIMELINE.map((step, i) => {
                const done = i <= current;
                return (
                  <li key={step.label} className="flex items-stretch gap-3">
                    <div className="flex w-4 flex-col items-center">
                      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border border-line ${done ? "bg-foreground" : "bg-background"} ${done ? "" : "border-muted"}`} />
                      {i < TIMELINE.length - 1 && <span className={`w-px flex-1 ${i < current ? "bg-foreground" : "bg-muted"}`} />}
                    </div>
                    <span className={`pb-6 font-mono text-xs uppercase tracking-wider ${i === current ? "font-bold" : done ? "" : "text-muted"}`}>
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          <p className="font-mono text-[10px] text-muted">
            Updated {new Date(report.updatedAt).toLocaleString()}
            {report.status === "received" && " · refreshing..."}
          </p>
        </>
      )}
    </Panel>
  );
}
