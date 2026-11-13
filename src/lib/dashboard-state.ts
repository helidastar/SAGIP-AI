export type IncidentDashboardStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "no-results";

export type DashboardPreviewState =
  | "loading"
  | "empty"
  | "map-error"
  | "no-results";

export function getIncidentDashboardStatus({
  loading,
  error,
  preview,
  total,
  hasFilters,
  visibleCount,
}: {
  loading: boolean;
  error: string | null;
  preview: DashboardPreviewState | null;
  total: number;
  hasFilters: boolean;
  visibleCount: number;
}): IncidentDashboardStatus {
  if (preview === "loading" || loading) return "loading";
  if (preview === "empty") return "empty";
  if (preview === "no-results") return "no-results";
  if (preview === "map-error") return "ready";
  if (error) return "error";
  if (total === 0 && !hasFilters) return "empty";
  if (visibleCount === 0) return "no-results";
  return "ready";
}
