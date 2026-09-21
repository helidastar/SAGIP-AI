"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Pill } from "@/components/ui/basics";
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
  { href: "/dashboard", label: "Incidents" },
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

  return (
    <StaffContext.Provider value={staff}>
      <header className="border-b border-black/10 dark:border-white/15">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 text-sm">
          <Link href="/dashboard" className="font-bold text-brand dark:text-blue-300">SAGIP-AI</Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={pathname === n.href ? "font-semibold underline" : "hover:underline"}>
              {n.label}
            </Link>
          ))}
          <span className="ml-auto flex items-center gap-2">
            {staff && (
              <>
                <span className="opacity-70">{staff.fullName ?? staff.email}</span>
                <Pill>{staff.role}</Pill>
              </>
            )}
            <button onClick={logout} className="underline">Log out</button>
          </span>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
        {error ? <p className="text-sev-critical">{error}</p> : staff ? children : <p className="opacity-60">Loading...</p>}
      </main>
    </StaffContext.Provider>
  );
}
