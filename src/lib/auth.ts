import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "responder" | "admin";

export interface Staff {
  id: string;
  email: string | undefined;
  fullName: string | null;
  role: StaffRole;
  teamId: string | null;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

/** Returns the logged-in staff member, or null if not logged in / no profile. */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, team_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return { id: user.id, email: user.email, fullName: profile.full_name, role: profile.role, teamId: profile.team_id };
}

/** Throws AuthError unless the caller is staff (and an admin, if required). */
export async function requireStaff(role?: StaffRole): Promise<Staff> {
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
