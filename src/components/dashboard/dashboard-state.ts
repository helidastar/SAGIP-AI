export type DashboardState =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "no-results";

export type DashboardPreviewState =
  | "loading"
  | "ready"
  | "empty"
  | "map-error"
  | "no-results"
  | "error";

export function getDashboardState({
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
}): DashboardState {
  if (preview === "loading") return "loading";
  if (preview === "error") return "error";
  if (preview === "empty") return "empty";
  if (preview === "no-results") return "no-results";
  if (error) return "error";
  if (loading) return "loading";
  if (preview === "map-error" || preview === "ready") return "ready";
  if (total === 0 && !hasFilters) return "empty";
  if (visibleCount === 0) return "no-results";
  return "ready";
}
