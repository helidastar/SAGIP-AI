import type { Severity } from "@/types";

/** High and critical are filled so they stand out in the monochrome sketch; always labeled, never color alone. */
const STYLES: Record<Severity, string> = {
  low: "bg-background text-foreground",
  moderate: "bg-background text-foreground",
  high: "bg-foreground text-background",
  critical: "bg-sev-critical border-sev-critical text-white",
};

export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center border border-line px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-4 tracking-wide ${STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}
