"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, inputClass } from "@/components/ui/basics";
import { api } from "@/lib/api-client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await api("/api/auth/login", { method: "POST", json: { email, password } });
    setLoading(false);
    if (!res.ok) return setError(res.error);
    // Only allow internal redirects.
    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required className={inputClass} />
      </Field>
      <Field label="Password">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className={inputClass} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
    </form>
  );
}
