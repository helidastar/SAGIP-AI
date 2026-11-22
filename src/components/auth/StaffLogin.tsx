"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import styles from "@/components/auth/staff-login.module.css";


/** Staff sign-in for responders and admins. Citizens never need an account. */
export function StaffLogin({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);
    const result = await api("/api/auth/login", {
      method: "POST",
      json: { email: email.trim(), password },
    });

    if (!result.ok) {
      setLoading(false);
      setPassword("");
      setError(
        result.status === 401
          ? "Wrong email or password."
          : result.status === 403
            ? "This account can't open the staff dashboard. Ask an admin for access."
            : result.status === 423
              ? "This account is locked. Ask an admin to unlock it."
              : result.status === 0
                ? "No connection. Check your internet and try again."
                : "Couldn't sign in. Try again.",
      );
      return;
    }

    const safeRedirect = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard";
    router.replace(safeRedirect);
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image src="/brand/sagip-ai-mark.svg" alt="" width={48} height={48} priority />
          <span>SAGIP-AI</span>
        </div>
        <h1 className={styles.title}>Staff sign in</h1>

        <form className={styles.form} onSubmit={submit} noValidate aria-busy={loading}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              required
              autoFocus
            />
          </label>

          <div className={styles.field}>
            <label htmlFor="staff-password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className={styles.showButton}
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className={styles.footer}>
        Need help in an emergency? <Link href="/">Report it here</Link> or call <a href="tel:911">911</a>.
      </p>
    </main>
  );
}
