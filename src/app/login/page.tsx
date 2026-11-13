import { OperationsLogin } from "@/components/auth/OperationsLogin";

const PREVIEW_STATES = ["idle", "submitting", "invalid", "empty", "locked"] as const;
type PreviewState = (typeof PREVIEW_STATES)[number];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, state, mode } = await searchParams;
  const redirectTo = typeof next === "string" && (next === "/dashboard" || next.startsWith("/dashboard/"))
    ? next
    : "/dashboard";
  const previewState = process.env.NODE_ENV === "development" && PREVIEW_STATES.includes(state as PreviewState)
    ? state as PreviewState
    : undefined;
  const previewMode = process.env.NODE_ENV === "development" && mode === "signup" ? "signup" : undefined;
  return <OperationsLogin redirectTo={redirectTo} previewState={previewState} previewMode={previewMode} />;
}
