export type IncidentDetailLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "notFound" }
  | { status: "error"; message: string };

export type IncidentDetailPreviewState =
  | "loading"
  | "photo-missing"
  | "photo-error"
  | "review"
  | "critical"
  | "not-found"
  | "error";

export type IncidentPhotoState = "normal" | "missing" | "failed";

export function getIncidentDetailPreviewState(): IncidentDetailPreviewState | null {
  if (process.env.NODE_ENV !== "development") return null;
  const requested = new URLSearchParams(window.location.search).get("state");
  switch (requested) {
    case "loading":
    case "photo-missing":
    case "photo-error":
    case "review":
    case "critical":
    case "not-found":
    case "error":
      return requested;
    default:
      return null;
  }
}
