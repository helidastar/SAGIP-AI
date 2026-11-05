import type { INCIDENT_TYPES, SEVERITY, REPORT_STATUSES } from "@/lib/constants";

export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type Severity = keyof typeof SEVERITY;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
