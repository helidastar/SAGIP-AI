"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { WORKFLOW } from "@/lib/workflow";

/**
 * The incident workflow as clickable steps with live counts, so staff can see
 * who acts next and where incidents are waiting. Clicking a step filters the list.
 */
export function WorkflowStrip({ active, onSelect, reload = 0 }: { active: string; onSelect: (statuses: string) => void; reload?: number }) {
  const [counts, setCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      WORKFLOW.map((step) =>
        api<{ total: number }>(`/api/incidents?status=${step.statuses.join(",")}&limit=1`).then((res) => [step.key, res.ok ? res.data.total : null] as const),
      ),
    ).then((pairs) => !cancelled && setCounts(Object.fromEntries(pairs)));
    return () => { cancelled = true; };
  }, [reload]);

  return (
    <nav aria-label="Incident workflow" className="grid grid-cols-2 border border-line sm:grid-cols-5">
      {WORKFLOW.map((step, i) => {
        const value = step.statuses.join(",");
        const selected = active === value;
        const count = counts[step.key];
        // Steps where people must act are highlighted when something is waiting.
        const waiting = (step.key === "review" || step.key === "assign") && !!count;
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onSelect(selected ? "" : value)}
            aria-pressed={selected}
            className={`flex flex-col gap-1 border-line p-3 text-left hover:bg-grid/60 ${i > 0 ? "sm:border-l" : ""} ${i % 2 ? "border-l sm:border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} ${selected ? "bg-foreground text-background hover:bg-foreground" : ""}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] opacity-60">STEP {i + 1}</span>
              <span className={`font-mono text-lg font-bold leading-none ${waiting && !selected ? "underline decoration-2 underline-offset-4" : ""}`}>
                {count ?? "–"}
              </span>
            </span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider">{step.label}</span>
            <span className="font-mono text-[10px] opacity-60">by {step.actor}</span>
          </button>
        );
      })}
    </nav>
  );
}
