import type { ReactNode } from "react";
import { STATUS_LABEL, type SeverityLabel } from "@/lib/citizen/reports";
import type { ReportStatus } from "@/types";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded bg-cz-primary px-5 py-3 font-body text-sm font-semibold text-white transition-colors hover:bg-cz-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded border border-cz-border-strong bg-cz-surface px-5 py-3 font-body text-sm font-semibold text-cz-text transition-colors hover:bg-cz-surface-2 disabled:cursor-not-allowed disabled:opacity-50";
export const inputCls =
  "w-full rounded border border-cz-border-strong bg-cz-surface px-3 py-2.5 font-body text-sm text-cz-text outline-none placeholder:text-cz-text-3 focus:border-cz-primary focus:ring-2 focus:ring-cz-primary/25";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-md border border-cz-border bg-cz-surface p-4 md:p-5 ${className}`}>{children}</section>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5 md:mb-7">
      <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-cz-text-2 md:text-base">{subtitle}</p>}
    </div>
  );
}

const SEV: Record<SeverityLabel, string> = {
  critical: "bg-cz-sev-critical-soft text-cz-sev-critical",
  high: "bg-cz-sev-high-soft text-cz-sev-high",
  medium: "bg-cz-sev-medium-soft text-cz-sev-medium",
  low: "bg-cz-sev-low-soft text-cz-sev-low",
};

export function SeverityChip({ severity, score }: { severity: SeverityLabel; score: number | null }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold capitalize ${SEV[severity]}`}>
      {severity}
      {score !== null && <span className="font-code font-medium">{score}</span>}
    </span>
  );
}

export function StatusChip({ status }: { status: ReportStatus }) {
  const tone =
    status === "resolved"
      ? "bg-cz-success-soft text-cz-success"
      : status === "rejected"
        ? "bg-cz-surface-2 text-cz-text-3"
        : "bg-cz-info-soft text-cz-link";
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>{STATUS_LABEL[status]}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-cz-surface-2 ${className}`} style={{ animation: "cz-pulse 1.4s ease-in-out infinite" }} />;
}
