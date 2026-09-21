// Set a staff member's role without writing SQL.
//
// Usage:
//   npm run make-admin -- someone@example.com
//   npm run make-admin -- someone@example.com --name "Juan Dela Cruz"
//   npm run make-admin -- someone@example.com --role responder     (demote)
//
// The user must already exist (Supabase → Authentication → Add user, or an invite).
// Updates both auth app_metadata.role (not user-editable) and public.profiles.role.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const ROLES = ["admin", "responder"];

async function findUser(db, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user || data.users.length < 1000) return user ?? null;
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      role: { type: "string", default: "admin" },
      name: { type: "string" },
    },
  });

  const email = positionals[0]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error('Usage: npm run make-admin -- <email> [--role admin|responder] [--name "Full Name"]');
    return 1;
  }
  if (!ROLES.includes(values.role)) {
    console.error(`--role must be one of: ${ROLES.join(", ")}`);
    return 1;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    return 1;
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const user = await findUser(db, email);
  if (!user) {
    console.error(`No user with email ${email}. Create them first in Supabase → Authentication → Add user.`);
    return 1;
  }

  const { error: authError } = await db.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, role: values.role },
  });
  if (authError) throw authError;

  const { data: before } = await db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  const { error: profileError } = await db.from("profiles").upsert({
    id: user.id,
    role: values.role,
    full_name: values.name ?? before?.full_name ?? null,
  });
  if (profileError) throw profileError;

  console.log(`${email}: ${before?.role ?? "(no profile)"} → ${values.role}${values.name ? ` (name: ${values.name})` : ""}`);
  if (!user.email_confirmed_at) console.log("Note: this user hasn't confirmed their email yet, so they can't log in until they do.");
  return 0;
}

// Set exitCode instead of calling process.exit(): exiting with open network handles crashes Node on Windows.
main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err?.message ?? err);
    process.exitCode = 1;
  },
);
