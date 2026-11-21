import { INCIDENT_TYPES, REPORT_STATUSES, SEVERITY } from "@/lib/constants";
import { PRIORITY_BANDS } from "@/lib/scoring";

/** One incident row as read for analytics (subset of the incidents view). */
export interface AnalyticsRow {
  status: string;
  confirmed_type: string | null;
  confirmed_severity: string | null;
  band: string | null;
  area_name: string | null;
  created_at: string;
}

export interface AnalyticsSummary {
  from: string;
  to: string;
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byBand: Record<string, number>;
  byArea: { area: string; count: number }[];
  byDay: { date: string; count: number }[];
}

export const MAX_ANALYTICS_DAYS = 92;
const DAY_MS = 86_400_000;
/** Philippine time (UTC+8, no daylight saving): day buckets follow the local calendar day. */
const PH_OFFSET_MS = 8 * 3_600_000;

const phDate = (iso: string | Date) => new Date(new Date(iso).getTime() + PH_OFFSET_MS).toISOString().slice(0, 10);
const zeroes = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>;

/**
 * Reads from/to query values. Default: the last 7 days up to now. Returns an error string for bad input.
 */
export function parseRange(fromParam: string | null, toParam: string | null, now = new Date()):
  { from: Date; to: Date } | { error: string } {
  const to = toParam ? new Date(toParam) : now;
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 7 * DAY_MS);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return { error: "Invalid from or to date." };
  if (from > to) return { error: "from must be before to." };
  if (to.getTime() - from.getTime() > MAX_ANALYTICS_DAYS * DAY_MS) return { error: `Range is limited to ${MAX_ANALYTICS_DAYS} days.` };
  return { from, to };
}

/** Counts incidents by type, severity, status, band, area and Philippine calendar day. Pure, no DB access. */
export function summarize(rows: AnalyticsRow[], from: Date, to: Date): AnalyticsSummary {
  const byType: Record<string, number> = { ...zeroes(INCIDENT_TYPES), unclassified: 0 };
  const bySeverity: Record<string, number> = { ...zeroes(Object.keys(SEVERITY)), unconfirmed: 0 };
  const byStatus = zeroes(REPORT_STATUSES);
  const byBand: Record<string, number> = { ...zeroes(PRIORITY_BANDS.map((b) => b.band)), unscored: 0 };
  const areas = new Map<string, number>();
  const days = new Map<string, number>();

  for (let t = new Date(phDate(from)).getTime(); t <= new Date(phDate(to)).getTime(); t += DAY_MS) {
    days.set(new Date(t).toISOString().slice(0, 10), 0);
  }

  for (const r of rows) {
    byType[r.confirmed_type && r.confirmed_type in byType ? r.confirmed_type : "unclassified"] += 1;
    bySeverity[r.confirmed_severity && r.confirmed_severity in bySeverity ? r.confirmed_severity : "unconfirmed"] += 1;
    if (r.status in byStatus) byStatus[r.status] += 1;
    byBand[r.band && r.band in byBand ? r.band : "unscored"] += 1;
    const area = r.area_name ?? "Outside mapped areas";
    areas.set(area, (areas.get(area) ?? 0) + 1);
    const day = phDate(r.created_at);
    days.set(day, (days.get(day) ?? 0) + 1);
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    total: rows.length,
    byType,
    bySeverity,
    byStatus,
    byBand,
    byArea: [...areas].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area)),
    byDay: [...days].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
