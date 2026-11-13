"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

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
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard#ranked-list", label: "Ranked list", icon: "list" },
  { href: "/dashboard/review", label: "Review queue", icon: "review" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "analytics" },
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

  const active = (href: string) => {
    if (href === "/dashboard#ranked-list") return false;
    return href === "/dashboard"
      ? pathname === "/dashboard" || pathname.startsWith("/dashboard/incidents")
      : pathname.startsWith(href);
  };

  return (
    <StaffContext.Provider value={staff}>
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
          <Link href="/dashboard" className="dashboard-brand" aria-label="SAGIP-AI operations portal home">
            <span className="dashboard-brand-mark" aria-hidden="true">
              <ShieldIcon />
            </span>
            <span className="dashboard-brand-copy">
              <strong>SAGIP-AI</strong>
              <span>Ops portal</span>
            </span>
          </Link>
          <p className="dashboard-nav-label">EOC Navigation</p>
          <nav aria-label="Primary">
            <ul className="dashboard-nav-list">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`dashboard-nav-link ${active(item.href) ? "is-active" : ""}`}
                    aria-current={active(item.href) && item.href !== "/dashboard#ranked-list" ? "page" : undefined}
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="dashboard-sidebar-account">
            <span className="dashboard-account-avatar" aria-hidden="true">
              <UserIcon />
            </span>
            <span className="dashboard-account-details">
              <strong>{staff?.fullName ?? staff?.email ?? "Staff account"}</strong>
              <span>{staff ? `${staff.role} account` : "Authentication"}</span>
            </span>
            <button type="button" className="dashboard-logout" onClick={logout} aria-label="Log out">
              <LogoutIcon />
            </button>
          </div>
        </aside>
        <div className="dashboard-main-column">
          <DashboardHeader
            name={staff?.fullName ?? staff?.email ?? "Staff"}
            role={staff?.role ?? "responder"}
          />
          <main className="dashboard-content">
            {error ? (
              <p role="alert" className="dashboard-global-error">{error}</p>
            ) : staff ? (
              children
            ) : (
              <p className="dashboard-auth-loading" aria-busy="true">Loading staff session...</p>
            )}
          </main>
        </div>
      </div>
    </StaffContext.Provider>
  );
}

function NavIcon({ name }: { name: string }) {
  if (name === "list") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="3" />
      </svg>
    );
  }
  if (name === "review") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M4 5h16v15H4zM8 3v4m8-4v4M7 11h10m-10 4h6" />
        <path d="m16 17 1.5 1.5L21 15" />
      </svg>
    );
  }
  if (name === "analytics") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="M8 16v-4m4 4V8m4 8v-6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" />
      <rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" />
      <rect x="14" y="14" width="6" height="6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.6-2.7 7.9-7 10-4.3-2.1-7-5.4-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.8-3.1 3-4.7 6.5-4.7s5.7 1.6 6.5 4.7" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M10 4H5v16h5m5-4 4-4-4-4m4 4H9" />
    </svg>
  );
}
