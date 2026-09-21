import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportStatus } from "@/types";

export const OPEN_STATUSES: ReportStatus[] = ["pending_review", "classified", "assigned", "in_progress"];

/** Status changes allowed via PATCH /status. Assignment is done via /assign. */
export const STATUS_TRANSITIONS: Partial<Record<ReportStatus, ReportStatus[]>> = {
  classified: ["rejected"],
  assigned: ["in_progress", "rejected"],
  in_progress: ["resolved", "assigned"],
  resolved: ["in_progress"],
};

export interface IncidentRow {
  id: string;
  tracking_code: string;
  description: string;
  photo_path: string | null;
  status: ReportStatus;
  confirmed_type: string | null;
  confirmed_severity: string | null;
  lat: number;
  lng: number;
  area_id: string | null;
  area_name: string | null;
  score: number | null;
  band: string | null;
  breakdown: Record<string, number> | null;
  overridden: boolean | null;
  team_id: string | null;
  created_at: string;
  updated_at: string;
}

export function toIncident(r: IncidentRow) {
  return {
    id: r.id,
    trackingCode: r.tracking_code,
    description: r.description,
    status: r.status,
    incidentType: r.confirmed_type,
    severity: r.confirmed_severity,
    location: { lat: r.lat, lng: r.lng, area: r.area_name },
    priority: r.score === null ? null : {
      score: Number(r.score),
      band: r.band,
      breakdown: r.breakdown,
      overridden: !!r.overridden,
    },
    teamId: r.team_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getIncidentRow(db: SupabaseClient, id: string) {
  const { data } = await db.from("incidents").select("*").eq("id", id).maybeSingle<IncidentRow>();
  return data;
}
