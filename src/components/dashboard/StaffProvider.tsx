"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SectionTitle, Tag } from "@/components/ui/basics";
import { api } from "@/lib/api-client";

export interface StaffUser {
  id: string;
  email?: string;
  fullName: string | null;
  role: "responder" | "admin";
  teamId: string | null;
}

const StaffContext = createContext<StaffUser | null>(null);
export const useStaff = () => useContext(StaffContext);

const NAV = [
  { href: "/dashboard", label: "Ranked list" },
  { href: "/dashboard/review", label: "Review queue" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

/** Loads the signed-in staff member and renders the dashboard nav. */
export function StaffProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<StaffUser>("/api/auth/me").then((res) => {
      if (res.status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      else if (!res.ok) setError(res.error);
      else setStaff(res.data);
    });
    // Only on first load; the proxy also redirects logged-out visitors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const active = (href: string) => (href === "/dashboard" ? pathname === href || pathname.startsWith("/dashboard/incidents") : pathname.startsWith(href));

  return (
    <StaffContext.Provider value={staff}>
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
    </StaffContext.Provider>
  );
}
