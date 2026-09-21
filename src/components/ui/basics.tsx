import type { ReactNode } from "react";

/**
 * Building blocks for the temporary test UI, styled after the initial wireframe sketch:
 * black borders, square corners, mono uppercase labels. The team will replace these.
 */

const mono = "font-mono uppercase tracking-wider";

/** Boxed panel with a header row: title on the left, optional hint and step ("1/3") on the right. */
export function Panel({
  title,
  hint,
  step,
  actions,
  children,
  className = "",
  bodyClassName = "p-3",
}: {
  title: string;
  hint?: string;
  step?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`border border-line bg-background ${className}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2.5">
        <h2 className={`${mono} text-xs font-bold`}>{title}</h2>
        {hint && <span className="font-mono text-[11px] text-muted">({hint})</span>}
        <span className="ml-auto flex items-center gap-3">
          {actions}
          {step && <span className="font-mono text-xs text-muted">{step}</span>}
        </span>
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border border-line p-3 ${className}`}>{children}</section>;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "border border-line bg-foreground text-background hover:bg-foreground/85",
    secondary: "border border-line bg-background hover:bg-grid",
    danger: "border border-sev-critical bg-background text-sev-critical hover:bg-sev-critical/10",
  }[variant];
  return (
    <button
      {...props}
      className={`${mono} px-4 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    />
  );
}

export const inputClass =
  "w-full border border-line bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20";

/** Small annotation label from the sketch, e.g. "↳ description field". */
export function Hint({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] text-muted ${className}`}>↳ {children}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <Hint>{label.toLowerCase()}</Hint>
      {children}
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="border border-sev-critical px-3 py-2 text-sm text-sev-critical">{children}</p>;
}

/** Outlined uppercase tag, e.g. REVIEW, LOW CONF, CRITICAL. */
export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center border border-line px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-4 tracking-wide ${className}`}>
      {children}
    </span>
  );
}

export const Pill = Tag;

export function StatusPill({ status }: { status: string }) {
  return <Tag className={status === "rejected" ? "line-through opacity-60" : ""}>{status.replace("_", " ")}</Tag>;
}

/** Priority band in a circle (P1–P4); dashed when there is no score yet. */
export function PriorityCircle({ band, size = "md" }: { band?: string | null; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-line font-mono font-bold ${dims} ${band ? "" : "border-dashed text-muted"}`}
      title={band ? `Priority ${band}` : "Not scored yet"}
    >
      {band ?? "—"}
    </span>
  );
}

export function PriorityBadge({ band, score, overridden }: { band?: string | null; score?: number | null; overridden?: boolean }) {
  if (!band) return <Tag className="border-dashed text-muted">no score</Tag>;
  return (
    <Tag className="bg-foreground text-background">
      {band} · {score}
      {overridden ? " · override" : ""}
    </Tag>
  );
}

export function Json({ value }: { value: unknown }) {
  return <pre className="overflow-x-auto border border-faint bg-grid/40 p-3 font-mono text-[11px]">{JSON.stringify(value, null, 2)}</pre>;
}

export function TestUiBanner() {
  return (
    <p className="border-b border-line px-4 py-1.5 text-center font-mono text-[11px] text-muted">
      Initial sketch UI for testing. Not the final design.
    </p>
  );
}

/** Section title from the sketch, e.g. "(C) CITIZEN PORTAL — MOBILE, NO ACCOUNT". */
export function SectionTitle({ letter, children }: { letter: string; children: ReactNode }) {
  return (
    <h1 className={`${mono} flex items-center gap-3 text-sm font-bold`}>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line text-xs">{letter}</span>
      {children}
    </h1>
  );
}

export function CameraIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function PinIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

export function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
