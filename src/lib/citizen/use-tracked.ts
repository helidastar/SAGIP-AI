"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { IncidentType, ReportStatus } from "@/types";
import { isResolved, sampleReports, type CitizenReport } from "./reports";
import { useSavedReports } from "./saved-reports";

interface TrackApi {
  trackingCode: string;
  status: ReportStatus;
  incidentType: IncidentType | null;
  updatedAt: string;
}

export type TrackedState =
  | { state: "loading" }
  | { state: "notfound" }
  | { state: "error"; message: string }
  | { state: "ready"; report: CitizenReport };

/** Looks up one report: samples locally, everything else through the tracking API (polled until resolved). */
export function useTracked(rawCode: string): TrackedState {
  const code = rawCode.trim().toUpperCase();
  const sample = sampleReports().find((r) => r.code === code);
  const saved = useSavedReports().find((r) => r.code === code);
  const [result, setResult] = useState<{ code: string; res: TrackApi | "notfound" | { error: string } } | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    if (!code || sample) return;
    let alive = true;
    finished.current = false;
    const run = () =>
      api<TrackApi>(`/api/reports/track/${encodeURIComponent(code)}`).then((r) => {
        if (!alive) return;
        if (r.ok) {
          finished.current = isResolved(r.data.status);
          setResult({ code, res: r.data });
        } else if (r.status === 404) {
          finished.current = true;
          setResult({ code, res: "notfound" });
        } else {
          setResult({ code, res: { error: r.error ?? "Something went wrong" } });
        }
      });
    void run();
    const timer = setInterval(() => { if (!finished.current) void run(); }, 5000);
    return () => { alive = false; clearInterval(timer); };
    // `sample` is derived from `code`; depending on code alone avoids re-running every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!code) return { state: "notfound" };
  if (sample) return { state: "ready", report: sample };
  if (!result || result.code !== code) return { state: "loading" };
  if (result.res === "notfound") return { state: "notfound" };
  if ("error" in result.res) return { state: "error", message: result.res.error };
  const api_ = result.res;
  return {
    state: "ready",
    report: {
      code: api_.trackingCode,
      title: saved?.title ?? "Emergency report",
      location: saved?.location ?? null,
      severity: null,
      score: null,
      status: api_.status,
      type: api_.incidentType,
      createdAt: saved?.createdAt ?? api_.updatedAt,
    },
  };
}

/** Current status for several of this device's reports at once (for the list). */
export function useStatuses(codes: string[]) {
  const key = codes.join(",");
  const [map, setMap] = useState<{ key: string; data: Record<string, TrackApi | null> } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void Promise.all(
      key.split(",").map((c) =>
        api<TrackApi>(`/api/reports/track/${encodeURIComponent(c)}`).then((r) => [c, r.ok ? r.data : null] as const),
      ),
    ).then((pairs) => {
      if (alive) setMap({ key, data: Object.fromEntries(pairs) });
    });
    return () => { alive = false; };
  }, [key]);

  return { loading: key !== "" && map?.key !== key, data: map?.key === key ? map.data : {} };
}
