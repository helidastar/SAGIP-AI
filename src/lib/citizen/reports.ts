import type { IncidentType, ReportStatus } from "@/types";

export type SeverityLabel = "critical" | "high" | "medium" | "low";

/** What the citizen UI shows for one report. Severity/score only exist for the sample reports. */
export interface CitizenReport {
  code: string;
  title: string;
  location: string | null;
  severity: SeverityLabel | null;
  score: number | null;
  status: ReportStatus;
  type: IncidentType | null;
  /** ISO time; used for "x min ago". */
  createdAt: string;
  sample?: boolean;
}

/** The six citizen-facing timeline steps and the internal statuses each one covers. */
export const TIMELINE = [
  { label: "Received", statuses: ["received"] },
  { label: "Under review", statuses: ["pending_review"] },
  { label: "Classified", statuses: ["classified"] },
  { label: "Team assigned", statuses: ["assigned"] },
  { label: "In progress", statuses: ["in_progress"] },
  { label: "Resolved", statuses: ["resolved"] },
] as const;

export function timelineIndex(status: ReportStatus): number {
  return TIMELINE.findIndex((s) => (s.statuses as readonly string[]).includes(status));
}

export const STATUS_LABEL: Record<ReportStatus, string> = {
  received: "Reported",
  pending_review: "Under review",
  classified: "Classified",
  assigned: "Assigned",
  in_progress: "En route",
  resolved: "Resolved",
  rejected: "Closed",
};

export function isResolved(status: ReportStatus) {
  return status === "resolved" || status === "rejected";
}

const MIN = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MIN).toISOString();

/** Sample reports so the list is never empty on a fresh device. Times are relative to "now". */
export function sampleReports(): CitizenReport[] {
  return [
    { code: "SGP-7H3M9X", title: "Flooding along the main road", location: "Brgy. Lahug", severity: "high", score: 78, status: "in_progress", type: "flood", createdAt: ago(45), sample: true },
    { code: "SGP-3K7D2N", title: "Fallen tree blocking street", location: "Brgy. Apas", severity: "medium", score: 52, status: "assigned", type: "fallen_debris", createdAt: ago(120), sample: true },
    { code: "SGP-2B6QPT", title: "Minor fire in vacant lot", location: "Brgy. Capitol Site", severity: "low", score: 21, status: "resolved", type: "fire", createdAt: ago(60 * 26), sample: true },
    { code: "SGP-8C4VQW", title: "Vehicle collision near Colon Street", location: "Brgy. Parian", severity: "high", score: 71, status: "resolved", type: "road_accident", createdAt: ago(60 * 50), sample: true },
    { code: "SGP-5T9LRE", title: "Person collapsed at public market", location: "Brgy. Carbon", severity: "critical", score: 92, status: "resolved", type: "medical_emergency", createdAt: ago(60 * 74), sample: true },
  ];
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / MIN));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
