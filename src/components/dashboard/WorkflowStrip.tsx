"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { WORKFLOW } from "@/lib/workflow";
import styles from "@/components/dashboard/Dashboard.module.css";

type WorkflowResult = {
  reload: number;
  counts: Record<string, number | null>;
};

export function WorkflowStrip({
  active,
  onSelect,
  reload = 0,
  forceLoading = false,
}: {
  active: string;
  onSelect: (statuses: string) => void;
  reload?: number;
  forceLoading?: boolean;
}) {
  const [result, setResult] = useState<WorkflowResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      WORKFLOW.map(async (step) => {
        const response = await api<{ total: number }>(
          `/api/incidents?status=${step.statuses.join(",")}&limit=1`,
        );
        return [step.key, response.ok ? response.data.total : null] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setResult({ reload, counts: Object.fromEntries(pairs) });
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const loading = forceLoading || result?.reload !== reload;

  return (
    <nav className={styles.workflow} aria-label="Incident workflow" aria-busy={loading}>
      {WORKFLOW.map((step, index) => {
        const statuses = step.statuses.join(",");
        const selected = active === statuses;
        const count = loading ? null : result?.counts[step.key];
        const actor = step.key === "assign"
          ? "Admin action"
          : step.key === "ai"
            ? "AI · automatic"
            : step.actor === "—"
              ? null
              : step.actor;
        return (
          <button
            type="button"
            key={step.key}
            className={`${styles.workflowStep} ${selected ? styles.workflowStepSelected : ""}`}
            onClick={() => onSelect(selected ? "" : statuses)}
            aria-pressed={selected}
          >
            <span className={styles.workflowTopline}>
              {loading ? (
                <span className={styles.workflowSkeletonCount} aria-hidden="true" />
              ) : (
                <span className={styles.workflowCount} aria-label={`${count ?? "Unavailable"} incidents`}>
                  {count ?? "—"}
                </span>
              )}
            </span>
            <span className={styles.workflowName}>{step.label}</span>
            {actor && <span className={styles.workflowActor}>{actor}</span>}
            <span className={styles.workflowProgress} aria-hidden="true">
              <span style={{ width: `${((index + 1) / WORKFLOW.length) * 100}%` }} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
