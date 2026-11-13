"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { WORKFLOW } from "@/lib/workflow";

export function WorkflowStrip({
  active,
  onSelect,
  reload = 0,
  loading = false,
}: {
  active: string;
  onSelect: (statuses: string) => void;
  reload?: number;
  loading?: boolean;
}) {
  const [countResult, setCountResult] = useState<{
    reload: number;
    counts: Record<string, number | null>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      WORKFLOW.map(async (step) => {
        const result = await api<{ total: number }>(
          `/api/incidents?status=${step.statuses.join(",")}&limit=1`,
        );
        return [step.key, result.ok ? result.data.total : null] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setCountResult({ reload, counts: Object.fromEntries(pairs) });
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const countsLoading = countResult?.reload !== reload;
  const counts = countsLoading ? {} : countResult.counts;
  const showSkeleton = loading || countsLoading;

  return (
    <nav
      aria-label="Incident workflow"
      aria-busy={showSkeleton}
      className="dashboard-workflow-strip"
    >
      {WORKFLOW.map((step, index) => {
        const value = step.statuses.join(",");
        const selected = active === value;
        const count = counts[step.key];
        const waiting = (step.key === "review" || step.key === "assign") && !!count;
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onSelect(selected ? "" : value)}
            aria-pressed={selected}
            className={`dashboard-workflow-step ${selected ? "is-selected" : ""} ${waiting ? "is-waiting" : ""}`}
          >
            <span className="dashboard-workflow-topline">
              <span className="dashboard-workflow-index">
                Step {index + 1}{waiting && <span aria-hidden="true"> •</span>}
              </span>
              {showSkeleton ? (
                <span className="dashboard-workflow-count-skeleton" aria-hidden="true" />
              ) : (
                <span
                  className="dashboard-workflow-count"
                  aria-label={count === null || count === undefined ? "Count unavailable" : `${count} incidents`}
                >
                  {count ?? "—"}
                </span>
              )}
            </span>
            <span className="dashboard-workflow-name">{step.label}</span>
            <span className="dashboard-workflow-actor">by {step.actor}</span>
            <span className="dashboard-workflow-progress" aria-hidden="true">
              <span style={{ width: `${((index + 1) / WORKFLOW.length) * 100}%` }} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
