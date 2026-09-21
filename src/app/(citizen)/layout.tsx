import Link from "next/link";
import { TestUiBanner } from "@/components/ui/basics";

export default function CitizenLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <TestUiBanner />
      <header className="border-b border-black/10 dark:border-white/15">
        <nav className="mx-auto flex max-w-xl items-center gap-4 px-4 py-3 text-sm">
          <Link href="/" className="font-bold text-brand dark:text-blue-300">SAGIP-AI</Link>
          <Link href="/" className="hover:underline">Report</Link>
          <Link href="/track" className="hover:underline">Track</Link>
          <Link href="/login" className="ml-auto opacity-70 hover:underline">Staff login</Link>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">{children}</main>
    </>
  );
}
