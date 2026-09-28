import { withStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Teams, for the assignment picker. */
export const GET = withStaff(async () => {
  const { data, error } = await createAdminClient().from("teams").select("id, name").order("name");
  if (error) return Response.json({ error: "Could not load teams" }, { status: 500 });
  return Response.json({ items: data });
});
