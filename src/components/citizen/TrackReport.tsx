"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { isResolved, sampleReports, timeAgo, type CitizenReport } from "@/lib/citizen/reports";
import { useSavedReports } from "@/lib/citizen/saved-reports";
import { useStatuses } from "@/lib/citizen/use-tracked";
import { ChevronRightIcon, ClipboardIcon, SearchIcon, TypeIcon } from "./icons";
import { ReportDetail } from "./ReportDetail";
import { btnPrimary, Card, inputCls, PageTitle, SeverityChip, Skeleton, StatusChip } from "./ui";

type Filter = "all" | "active" | "resolved";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
];

function ReportRow({ r }: { r: CitizenReport }) {
  return (
    <li>
      <Link
        href={`/track?code=${encodeURIComponent(r.code)}`}
        className="flex items-center gap-3 rounded-md border border-cz-border bg-cz-surface p-3.5 transition-colors hover:border-cz-border-strong hover:bg-cz-surface-2 md:p-4"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-cz-info-soft text-cz-link">
          <TypeIcon type={r.type} className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-semibold">{r.title}</span>
          {r.location && <span className="block truncate text-sm text-cz-text-2">{r.location}</span>}
          <span className="mt-2 flex flex-wrap items-center gap-2">
            {r.severity && <SeverityChip severity={r.severity} score={r.score} />}
            <StatusChip status={r.status} />
            <span suppressHydrationWarning className="font-code text-xs text-cz-text-3">{r.code} · {timeAgo(r.createdAt)}</span>
          </span>
        </span>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-cz-text-3" />
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading reports" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 rounded-md border border-cz-border bg-cz-surface p-4">
          <Skeleton className="h-11 w-11" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReportList() {
  const router = useRouter();
  const saved = useSavedReports();
  const { loading, data } = useStatuses(useMemo(() => saved.map((s) => s.code), [saved]));
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  // This device's reports (live status, newest first), then the samples.
  const reports = useMemo<CitizenReport[]>(() => {
    const mine: CitizenReport[] = saved.map((s) => {
      const live = data[s.code];
      return {
        code: s.code,
        title: s.title,
        location: s.location,
        severity: null,
        score: null,
        status: live?.status ?? "received",
        type: live?.incidentType ?? null,
        createdAt: s.createdAt,
      };
    });
    return [...mine, ...sampleReports()];
  }, [saved, data]);

  const counts = {
    all: reports.length,
    active: reports.filter((r) => !isResolved(r.status)).length,
    resolved: reports.filter((r) => isResolved(r.status)).length,
  };
  const shown = reports.filter((r) => filter === "all" || (filter === "active" ? !isResolved(r.status) : isResolved(r.status)));

  function find(e: React.FormEvent) {
    e.preventDefault();
    const code = search.trim().toUpperCase();
    if (code) router.push(`/track?code=${encodeURIComponent(code)}`);
  }

  return (
    <>
      <PageTitle title="Track report" subtitle="Search with your tracking code, or open one of the reports below." />

      <form onSubmit={find} className="mb-5 flex gap-2 md:max-w-xl">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cz-text-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SGP-XXXXXX"
            aria-label="Tracking code"
            autoCapitalize="characters"
            className={`${inputCls} pl-9 font-code uppercase`}
          />
        </div>
        <button type="submit" disabled={!search.trim()} className={btnPrimary}>Find</button>
      </form>

      <div role="tablist" aria-label="Filter reports" className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === f.id ? "border-cz-primary bg-cz-primary text-white" : "border-cz-border-strong bg-cz-surface text-cz-text-2 hover:bg-cz-surface-2"
            }`}
          >
            {f.label} <span className="font-code text-xs opacity-80">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {loading && saved.length > 0 && shown.length === 0 ? (
        <ListSkeleton />
      ) : shown.length === 0 ? (
        <Card className="py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cz-surface-2 text-cz-text-3"><ClipboardIcon className="h-6 w-6" /></span>
          <h2 className="mt-3 font-display text-lg font-bold">No reports here</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-cz-text-2">Nothing matches this filter yet.</p>
          <Link href="/" className={`${btnPrimary} mt-4`}>Report an emergency</Link>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => <ReportRow key={r.code} r={r} />)}
        </ul>
      )}
    </>
  );
}

export function TrackReport({ initialCode = "" }: { initialCode?: string }) {
  return initialCode.trim() ? <ReportDetail code={initialCode} /> : <ReportList />;
}
