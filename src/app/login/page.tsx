import Link from "next/link";
import { LoginForm } from "@/components/dashboard/LoginForm";
import { TestUiBanner } from "@/components/ui/basics";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <TestUiBanner />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-4 py-12">
        <Link href="/" className="text-sm font-bold text-brand dark:text-blue-300">SAGIP-AI</Link>
        <h1 className="text-2xl font-bold">Responder login</h1>
        <p className="text-sm opacity-70">Staff accounts are created by an admin in Supabase.</p>
        <LoginForm next={typeof next === "string" ? next : "/dashboard"} />
      </main>
    </>
  );
}
