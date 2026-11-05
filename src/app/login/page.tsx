import { OperationsLogin } from "@/components/auth/OperationsLogin";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const redirectTo = typeof next === "string" && (next === "/dashboard" || next.startsWith("/dashboard/"))
    ? next
    : "/dashboard";
  return <OperationsLogin redirectTo={redirectTo} />;
}
