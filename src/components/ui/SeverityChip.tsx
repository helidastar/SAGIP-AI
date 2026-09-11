import type { Severity } from "@/types";

const STYLES: Record<Severity, string> = {
  low: "bg-sev-low text-white",
  moderate: "bg-sev-moderate text-black",
  high: "bg-sev-high text-white",
  critical: "bg-sev-critical text-white",
};

/** Severity is always shown with a text label, never color alone. */
export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}
