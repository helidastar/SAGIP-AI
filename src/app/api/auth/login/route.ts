import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return Response.json({ error: "Invalid email or password" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, team_id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return Response.json({ error: "This account is not registered as staff" }, { status: 403 });
  }

  return Response.json({
    id: data.user.id,
    email: data.user.email,
    fullName: profile.full_name,
    role: profile.role,
    teamId: profile.team_id,
  });
}
