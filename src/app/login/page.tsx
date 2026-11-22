import type { Metadata } from "next";
import { StaffLogin } from "@/components/auth/StaffLogin";

export const metadata: Metadata = {
  title: "Staff sign in | SAGIP-AI",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const redirectTo =
    typeof next === "string" && (next === "/dashboard" || next.startsWith("/dashboard/"))
      ? next
      : "/dashboard";

  return <StaffLogin redirectTo={redirectTo} />;
}
