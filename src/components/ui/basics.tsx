import type { ReactNode } from "react";

/** Minimal building blocks for the temporary test UI. Replace when the real design is decided. */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-black/10 p-4 dark:border-white/15 ${className}`}>{children}</section>;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-brand text-white hover:opacity-90",
    secondary: "border border-black/20 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10",
    danger: "bg-sev-critical text-white hover:opacity-90",
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export const inputClass =
  "w-full rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-md bg-sev-critical/10 px-3 py-2 text-sm text-sev-critical">{children}</p>;
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-semibold dark:bg-white/10 ${className}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const color: Record<string, string> = {
    received: "",
    pending_review: "bg-review/15 text-review",
    classified: "bg-brand/15 text-brand dark:text-blue-300",
    assigned: "bg-sev-moderate/20",
    in_progress: "bg-sev-high/15 text-sev-high",
    resolved: "bg-sev-low/15 text-sev-low",
    rejected: "line-through opacity-70",
  };
  return <Pill className={color[status] ?? ""}>{status.replace("_", " ")}</Pill>;
}

export function PriorityBadge({ band, score, overridden }: { band?: string | null; score?: number | null; overridden?: boolean }) {
  if (!band) return <span className="text-xs opacity-60">no score</span>;
  return (
    <Pill className="bg-brand text-white">
      {band} · {score}
      {overridden ? " · overridden" : ""}
    </Pill>
  );
}

export function Json({ value }: { value: unknown }) {
  return <pre className="overflow-x-auto rounded-md bg-black/5 p-3 text-xs dark:bg-white/10">{JSON.stringify(value, null, 2)}</pre>;
}

export function TestUiBanner() {
  return (
    <p className="bg-sev-moderate/25 px-4 py-1.5 text-center text-xs">
      Temporary test UI for checking the backend. Not the final design.
    </p>
  );
}
