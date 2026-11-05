import Link from "next/link";
import { SectionTitle, TestUiBanner } from "@/components/ui/basics";

export default function CitizenLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <TestUiBanner />
      <header className="border-b border-line">
        <nav className="mx-auto flex max-w-md flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 font-mono text-xs uppercase tracking-wider">
          <Link href="/" className="font-bold">SAGIP-AI</Link>
          <Link href="/" className="text-muted hover:text-foreground">Report</Link>
          <Link href="/track" className="text-muted hover:text-foreground">Track</Link>
          <Link href="/login" className="ml-auto text-muted hover:text-foreground">Staff login</Link>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <SectionTitle letter="C">Citizen portal — mobile, no account</SectionTitle>
        {children}
      </main>
    </>
  );
}
