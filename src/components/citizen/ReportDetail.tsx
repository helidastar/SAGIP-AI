"use client";

import Link from "next/link";
import { CheckIcon, ArrowLeftIcon, TypeIcon } from "./icons";
import { CopyCode } from "./CopyCode";
import { btnPrimary, btnSecondary, Card, SeverityChip, Skeleton, StatusChip } from "./ui";
import { STATUS_LABEL, TIMELINE, timeAgo, timelineIndex, type CitizenReport } from "@/lib/citizen/reports";
import { useTracked } from "@/lib/citizen/use-tracked";

function Timeline({ report }: { report: CitizenReport }) {
  if (report.status === "rejected") {
    return <p className="rounded border border-cz-border bg-cz-surface-2 px-3 py-2 text-sm font-semibold text-cz-text-2">This report was closed by responders.</p>;
  }
  const current = timelineIndex(report.status);
  const allDone = report.status === "resolved";
  return (
    <ol>
      {TIMELINE.map((step, i) => {
        const done = i < current || allDone;
        const active = i === current && !allDone;
        return (
          <li key={step.label} className="flex gap-3">
            <div className="flex w-6 flex-col items-center">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  done ? "border-cz-success bg-cz-success text-white" : active ? "border-cz-primary bg-cz-primary text-white" : "border-cz-border-strong bg-cz-surface"
                }`}
              >
                {done ? <CheckIcon className="h-3.5 w-3.5" /> : active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
              {i < TIMELINE.length - 1 && <span className={`w-0.5 flex-1 ${done ? "bg-cz-success" : "bg-cz-border-strong"}`} />}
            </div>
            <div className="pb-5">
              <p className={`text-sm ${active ? "font-bold" : done ? "font-semibold" : "text-cz-text-3"}`}>{step.label}</p>
              {active && <p className="text-xs text-cz-text-2">Current status</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading report" className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** One report: summary + timeline. `justSubmitted` adds the confirmation banner and next-step buttons. */
export function ReportDetail({ code, justSubmitted = false }: { code: string; justSubmitted?: boolean }) {
  const tracked = useTracked(code);

  if (tracked.state === "loading") return <DetailSkeleton />;

  if (tracked.state !== "ready") {
    const notFound = tracked.state === "notfound";
    return (
      <Card className="py-10 text-center">
        <h2 className="font-display text-xl font-bold">{notFound ? "Report not found" : "Couldn't load this report"}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-cz-text-2">
          {notFound ? `We couldn't find a report with the code ${code.toUpperCase() || "you entered"}. Check the code and try again.` : `${tracked.message}. We'll keep retrying.`}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/track" className={btnSecondary}>All reports</Link>
        </div>
      </Card>
    );
  }

  const r = tracked.report;
  return (
    <div className="flex flex-col gap-4">
      {justSubmitted ? (
        <div role="status" className="rounded-md border border-cz-success bg-cz-success-soft p-4">
          <p className="font-display text-lg font-bold text-cz-success">Report received</p>
          <p className="mt-1 text-sm text-cz-text">Responders will review your report. Save your tracking code. There is no account; this is how you follow it.</p>
        </div>
      ) : (
        <Link href="/track" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-cz-link hover:underline">
          <ArrowLeftIcon /> All reports
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr] md:gap-6">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-cz-info-soft text-cz-link"><TypeIcon type={r.type} className="h-6 w-6" /></span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold leading-snug">{r.title}</h2>
              {r.location && <p className="text-sm text-cz-text-2">{r.location}</p>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {r.severity && <SeverityChip severity={r.severity} score={r.score} />}
            <StatusChip status={r.status} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-cz-text-2">
            <CopyCode code={r.code} />
            <span suppressHydrationWarning>{timeAgo(r.createdAt)}</span>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-display text-base font-semibold">Progress · {STATUS_LABEL[r.status]}</h3>
          <Timeline report={r} />
        </Card>
      </div>

      {justSubmitted && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/track" className={`${btnPrimary} sm:flex-1`}>Track report</Link>
          <Link href="/" className={`${btnSecondary} sm:flex-1`}>Report another emergency</Link>
        </div>
      )}
    </div>
  );
}
