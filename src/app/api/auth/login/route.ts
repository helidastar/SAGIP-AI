import { signInStaff } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const result = await signInStaff(email, password);
  if (result.error) {
    const responses = {
      invalid_credentials: { status: 401, error: "invalid_credentials" },
      account_locked: { status: 423, error: "account_locked" },
      permission_denied: { status: 403, error: "permission_denied" },
      network_error: { status: 503, error: "network_error" },
      verification_failed: { status: 503, error: "verification_failed" },
    } as const;
    const response = responses[result.error];
    return Response.json({ error: response.error }, { status: response.status });
  }

  return Response.json(result.staff);
}
