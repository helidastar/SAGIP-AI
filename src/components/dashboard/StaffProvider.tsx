"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SectionTitle, Tag } from "@/components/ui/basics";
import { api } from "@/lib/api-client";
import type { Role } from "@/types/auth";

export interface StaffUser {
  id: string;
  email?: string;
  fullName: string | null;
  role: Role;
  teamId: string | null;
}

const StaffContext = createContext<StaffUser | null>(null);
export const useStaff = () => useContext(StaffContext);

const NAV = [
  { href: "/dashboard", label: "Ranked list" },
  { href: "/dashboard/review", label: "Review queue" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

/** Loads the signed-in staff member and renders the dashboard or operations portal navigation. */
export function StaffProvider({
  children,
  initialStaff,
  portal = "dashboard",
}: {
  children: ReactNode;
  initialStaff?: StaffUser;
  portal?: "dashboard" | "admin";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<StaffUser | null>(initialStaff ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStaff) return;
    void api<StaffUser>("/api/auth/me").then((res) => {
      if (res.status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      else if (!res.ok) setError(res.error);
      else setStaff(res.data);
    });
    // Only load the current staff member on first mount; the proxy also redirects logged-out visitors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStaff]);

  async function logout() {
    const result = await api("/api/auth/logout", { method: "POST" });
    if (!result.ok) {
      setError("Unable to sign out. Please try again.");
      return;
    }
    router.replace(portal === "admin" ? "/admin/login" : "/login");
    router.refresh();
  }

  const active = (href: string) => (href === "/dashboard" ? pathname === href || pathname.startsWith("/dashboard/incidents") : pathname.startsWith(href));

  return (
    <StaffContext.Provider value={staff}>
      {portal === "admin" ? (
        <div className="flex min-h-screen flex-1 flex-col md:flex-row">
          <aside className="flex w-full shrink-0 flex-col border-b border-line bg-background p-4 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
            <Link href="/admin/dashboard" className="mb-5 font-mono text-sm font-bold uppercase tracking-wider">SAGIP-AI</Link>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">Operations portal</p>
            <nav aria-label="Operations portal" className="flex flex-wrap gap-2 md:flex-col">
              <Link href="/admin/dashboard" className={pathname === "/admin/dashboard" ? "border border-line bg-grid px-3 py-2 font-mono text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2" : "px-3 py-2 font-mono text-xs hover:bg-grid focus-visible:outline-2 focus-visible:outline-offset-2"}>
                Operations
              </Link>
              <Link href="/dashboard" className="px-3 py-2 font-mono text-xs hover:bg-grid focus-visible:outline-2 focus-visible:outline-offset-2">Incident workspace</Link>
              {staff?.role === "admin" && (
                <Link href="/dashboard" className="px-3 py-2 font-mono text-xs hover:bg-grid focus-visible:outline-2 focus-visible:outline-offset-2">Team assignment</Link>
              )}
              <Link href="/dashboard" className="px-3 py-2 font-mono text-xs hover:bg-grid focus-visible:outline-2 focus-visible:outline-offset-2">Audit log</Link>
            </nav>
            <p className="mt-3 font-mono text-[10px] text-muted">
              Team assignment and audit history are available from incident details.
            </p>
            <div className="mt-5 border-t border-line pt-4 md:mt-auto">
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm px-2 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2">
                  <span className="min-w-0 flex-1 truncate text-left text-muted">{staff?.fullName ?? staff?.email}</span>
                  {staff && <Tag>{staff.role}</Tag>}
                  <span aria-hidden="true">⌄</span>
                </summary>
                <div className="mt-2 border border-line bg-background p-3">
                  <button onClick={logout} className="font-mono text-[10px] uppercase underline focus-visible:outline-2 focus-visible:outline-offset-2">
                    Log out
                  </button>
                </div>
              </details>
            </div>
            {error && <p role="alert" className="mt-3 text-xs text-sev-critical">{error}</p>}
          </aside>
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6">
            {staff ? children : <p className="font-mono text-xs text-muted">Loading...</p>}
          </main>
        </div>
      ) : (
        <>
          <header className="border-b border-line">
            <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 font-mono text-xs uppercase tracking-wider">
              <Link href="/dashboard" className="font-bold">SAGIP-AI</Link>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className={active(n.href) ? "font-bold underline underline-offset-4" : "text-muted hover:text-foreground"}>
                  {n.label}
                </Link>
              ))}
              <span className="ml-auto flex items-center gap-3 normal-case tracking-normal">
                {staff && (
                  <>
                    <span className="text-muted">{staff.fullName ?? staff.email}</span>
                    <Tag>{staff.role}</Tag>
                  </>
                )}
                <button onClick={logout} className="font-mono text-xs uppercase underline">Log out</button>
              </span>
            </nav>
          </header>
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6">
            <SectionTitle letter="A">Responder / admin dashboard — desktop, authenticated</SectionTitle>
            {error ? <p className="text-sev-critical">{error}</p> : staff ? children : <p className="font-mono text-xs text-muted">Loading...</p>}
          </main>
        </>
      )}
    </StaffContext.Provider>
  );
}
