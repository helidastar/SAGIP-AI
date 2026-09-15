"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, ErrorText, inputClass, StatusPill } from "@/components/ui/basics";
import { api } from "@/lib/api-client";

interface Tracked {
  trackingCode: string;
  status: string;
  publicStatus: string;
  incidentType: string | null;
  updatedAt: string;
}

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

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          void lookup(code);
        }}
        className="flex gap-2"
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SGP-XXXXXX" className={inputClass} />
        <Button type="submit" disabled={loading}>Check</Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {report && (
        <Card className="flex flex-col gap-2">
          <p className="font-mono text-lg font-bold">{report.trackingCode}</p>
          <p className="text-lg">{report.publicStatus}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusPill status={report.status} />
            {report.incidentType && <span>Type: {report.incidentType.replace("_", " ")}</span>}
          </div>
          <p className="text-xs opacity-60">
            Updated {new Date(report.updatedAt).toLocaleString()}
            {report.status === "received" && " · refreshing..."}
          </p>
        </Card>
      )}
    </div>
  );
}
