import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client for Route Handlers. Bypasses RLS — never import from client components. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const PHOTO_BUCKET = "report-photos";
