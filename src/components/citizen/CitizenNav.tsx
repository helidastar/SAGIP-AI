"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardIcon } from "./icons";

const TABS = [
  { href: "/", label: "Report", icon: AlertTab, match: (p: string) => p === "/" },
  { href: "/track", label: "Track report", icon: ClipboardIcon, match: (p: string) => p.startsWith("/track") || p.startsWith("/submitted") },
];

function AlertTab({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 4l9 16H3L12 4zM12 10v4M12 17v.5" />
    </svg>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="SAGIP-AI home">
      <Image src="/brand/sagip-ai-mark.svg" alt="" width={36} height={36} loading="eager" className="h-9 w-9" />
      <span className="font-display text-lg font-bold tracking-tight text-white">SAGIP-AI</span>
    </Link>
  );
}

/** Top bar (all sizes) + bottom tabs (phones). Two sections only: Report and Track report. */
export function CitizenNav() {
  const pathname = usePathname();

  return (
    <>
      <header className="bg-cz-nav text-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-8 px-4 md:h-16 md:px-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {TABS.map((t) => {
              const active = t.match(pathname);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded px-4 py-2 font-body text-sm font-semibold transition-colors ${active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/login" className="ml-auto rounded border border-white/30 px-3 py-1.5 font-body text-sm font-semibold text-white hover:bg-white/10">
            Staff login
          </Link>
        </div>
      </header>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t border-cz-border bg-cz-surface md:hidden">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 font-body text-xs font-semibold ${active ? "text-cz-link" : "text-cz-text-3"}`}
            >
              <Icon className="h-5 w-5" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
