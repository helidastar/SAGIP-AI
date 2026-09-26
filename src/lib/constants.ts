import type { IncidentType, ReportStatus } from "@/types";

export const INCIDENT_TYPES = [
  "fire",
  "flood",
  "landslide",
  "road_accident",
  "structural_damage",
  "medical_emergency",
  "fallen_debris",
  "other",
] as const;

export const SEVERITY = { low: 1, moderate: 2, high: 3, critical: 4 } as const;

export const REPORT_STATUSES = [
  "received",
  "pending_review",
  "classified",
  "assigned",
  "in_progress",
  "resolved",
  "rejected",
] as const;

export const OPEN_STATUSES: ReportStatus[] = ["pending_review", "classified", "assigned", "in_progress"];

/** Status changes allowed via PATCH /api/incidents/{id}/status. Assignment is done via /assign. */
export const STATUS_TRANSITIONS: Partial<Record<ReportStatus, ReportStatus[]>> = {
  classified: ["rejected"],
  assigned: ["in_progress", "rejected"],
  in_progress: ["resolved", "assigned"],
  resolved: ["in_progress"],
};

/** Reports below this AI confidence go to human review. Tune after benchmarking. */
export const CONFIDENCE_THRESHOLD = Number(process.env.CONFIDENCE_THRESHOLD ?? 0.7);

/** AI severities that always require human review. */
export const REVIEW_SEVERITIES = ["high", "critical"] as const;

/** Proposed weights; placeholders until the priority-scoring design doc is finalized. */
export const PRIORITY_WEIGHTS = {
  severity: 0.45,
  population: 0.25,
  locationRisk: 0.15,
  type: 0.15,
} as const;

export const TYPE_WEIGHTS: Record<IncidentType, number> = {
  fire: 1.0,
  medical_emergency: 1.0,
  structural_damage: 0.9,
  flood: 0.85,
  landslide: 0.85,
  road_accident: 0.8,
  fallen_debris: 0.5,
  other: 0.4,
};
