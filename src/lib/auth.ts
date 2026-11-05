import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types/auth";

export type { Profile, Role } from "@/types/auth";
export type StaffRole = Role;

export interface Staff {
  id: string;
  email: string | undefined;
  fullName: string | null;
  role: Role;
  teamId: string | null;
}

export type SignInFailure =
  | "invalid_credentials"
  | "account_locked"
  | "permission_denied"
  | "network_error"
  | "verification_failed";

export type SignInResult = { staff: Staff; error: null } | { staff: null; error: SignInFailure };

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

function isRole(role: unknown): role is Role {
  return role === "responder" || role === "admin";
}

function isRetryableFetchError(error: { name?: string; status?: number; message?: string; code?: string }) {
  return error.name === "AuthRetryableFetchError"
    || error.status === 0
    || error.code === "FETCH_ERROR"
    || /fetch failed|network|timed? out/i.test(error.message ?? "");
}

function staffFromProfile(user: { id: string; email?: string }, profile: Profile): Staff {
  return {
    id: user.id,
    email: user.email,
    fullName: profile.full_name,
    role: profile.role,
    teamId: profile.team_id,
  };
}

/** Signs in an email/password account and verifies that it has an allowed staff profile. */
export async function signInStaff(email: string, password: string): Promise<SignInResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "user_banned") return { staff: null, error: "account_locked" };
    if (isRetryableFetchError(error)) return { staff: null, error: "network_error" };
    return { staff: null, error: "invalid_credentials" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, team_id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    return {
      staff: null,
      error: isRetryableFetchError(profileError) ? "network_error" : "verification_failed",
    };
  }

  if (!profile || !isRole(profile.role)) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    return { staff: null, error: "permission_denied" };
  }

  return { staff: staffFromProfile(data.user, profile), error: null };
}

/** Returns the logged-in staff member, or null if not logged in / no profile. */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, team_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !isRole(profile.role)) return null;

  return staffFromProfile(user, profile);
}

/** Throws AuthError unless the caller is staff (and an admin, if required). */
export async function requireStaff(role?: Role): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new AuthError(401, "Not signed in");
  if (role === "admin" && staff.role !== "admin") throw new AuthError(403, "Admins only");
  return staff;
}

/** Wraps a Route Handler so AuthError becomes a 401/403 JSON response. */
export function withStaff<Ctx>(
  handler: (request: Request, ctx: Ctx, staff: Staff) => Promise<Response>,
  role?: StaffRole,
) {
  return async (request: Request, ctx: Ctx) => {
    try {
      return await handler(request, ctx, await requireStaff(role));
    } catch (err) {
      if (err instanceof AuthError) return Response.json({ error: err.message }, { status: err.status });
      throw err;
    }
  };
}
