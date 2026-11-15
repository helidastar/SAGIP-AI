import { Inter, JetBrains_Mono } from "next/font/google";
import { StaffAuthPage } from "@/components/auth/StaffAuthPage";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-auth-inter",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-auth-mono",
});

const PREVIEW_STATES = ["idle", "focused", "submitting", "invalid", "empty", "locked"] as const;
type PreviewState = (typeof PREVIEW_STATES)[number];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, state, mode } = await searchParams;
  const redirectTo = typeof next === "string" ? next : "/dashboard";
  const previewState = process.env.NODE_ENV === "development"
    && typeof state === "string"
    && PREVIEW_STATES.includes(state as PreviewState)
    ? state as PreviewState
    : undefined;
  const previewMode = process.env.NODE_ENV === "development" && mode === "signup" ? "signup" : undefined;

  return (
    <StaffAuthPage
      redirectTo={redirectTo}
      previewState={previewState}
      previewMode={previewMode}
      fontClassName={`${inter.variable} ${jetBrainsMono.variable}`}
    />
  );
}
