import Link from "next/link";
import { LoginForm } from "@/components/dashboard/LoginForm";
import { Panel, SectionTitle, TestUiBanner } from "@/components/ui/basics";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <TestUiBanner />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-4 py-12">
        <Link href="/" className="font-mono text-xs font-bold uppercase tracking-wider">SAGIP-AI</Link>
        <SectionTitle letter="A">Staff sign in</SectionTitle>
        <Panel title="Responder login" bodyClassName="flex flex-col gap-3 p-4">
          <LoginForm next={typeof next === "string" ? next : "/dashboard"} />
          <p className="font-mono text-[10px] text-muted">Staff accounts are created by an admin (npm run make-admin).</p>
        </Panel>
      </main>
    </>
  );
}
