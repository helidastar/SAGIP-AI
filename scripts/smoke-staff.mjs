// End-to-end smoke test for the staff (login-protected) API.
//
// Usage (recommended – no env setup needed; auto-provisions temp users):
//   npm run smoke:staff
//
// Or set credentials manually in .env.test.local and run the same command:
//   TEST_ADMIN_EMAIL=...     TEST_ADMIN_PASSWORD=...
//   TEST_RESPONDER_EMAIL=... TEST_RESPONDER_PASSWORD=...
//
// Other optional env vars:
//   SMOKE_BASE_URL=http://localhost:3000   (default)
//   SMOKE_KEEP_REPORTS=1                  (skip deleting created test reports)
//
// Creates two test reports. Cleanup happens in the finally block unless
// SMOKE_KEEP_REPORTS=1 is set. Responder team membership is always restored.
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

// SUPABASE_SERVICE_ROLE_KEY is always required (needed for admin provisioning and cleanup).
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const SUPABASE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!SUPABASE_BASE_URL) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}
const db = createClient(SUPABASE_BASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}
const short = (v) => JSON.stringify(v)?.slice(0, 220);

/** Minimal cookie-jar client so each user keeps their own Supabase session. */
function session() {
  const jar = new Map();
  return async function call(method, path, body, extraHeaders = {}) {
    const headers = { ...extraHeaders, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
    let payload = body;
    if (body && !(body instanceof FormData)) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      const expired = attrs.some((a) => /max-age=0|expires=thu, 01 jan 1970/i.test(a.trim()));
      if (expired || !value) jar.delete(name);
      else jar.set(name, value);
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, json };
  };
}

const admin = session();
const responder = session();
const anon = session();

/**
 * Tracks state that must be cleaned up in the finally block.
 *   tempUsers          – auth UIDs of users created by this run (empty if credentials were provided via env).
 *   reports            – report IDs created by this run.
 *   responderId        – the responder's auth UID (needed to restore team membership).
 *   responderTeamBefore – the team_id the responder had before we changed it (undefined = not yet saved).
 */
const created = {
  tempUsers: [],
  reports: [],
  responderTeamBefore: undefined,
  responderId: undefined,
};

async function submitReport(description, lat, lng) {
  const fd = new FormData();
  fd.append("description", description);
  fd.append("lat", String(lat));
  fd.append("lng", String(lng));
  const r = await anon("POST", "/api/reports", fd, { "x-forwarded-for": `10.200.${Date.now() % 250}.${created.reports.length + 1}` });
  if (r.status !== 201) throw new Error(`submit failed: ${r.status} ${short(r.json)}`);
  created.reports.push(r.json.id);
  for (let i = 0; i < 45; i++) {
    const t = await anon("GET", `/api/reports/track/${r.json.trackingCode}`);
    if (t.json?.status && t.json.status !== "received") return { ...r.json, status: t.json.status };
    await new Promise((res) => setTimeout(res, 2000));
  }
  return { ...r.json, status: "received" };
}

// ---------------------------------------------------------------------------
// Auto-provision fallback: create temp users if credentials not in env
// ---------------------------------------------------------------------------
async function provisionTestUsers() {
  const haveAdmin =
    process.env.TEST_ADMIN_EMAIL &&
    process.env.TEST_ADMIN_PASSWORD &&
    process.env.TEST_RESPONDER_EMAIL &&
    process.env.TEST_RESPONDER_PASSWORD;

  if (haveAdmin) {
    // Use credentials supplied by the caller; nothing to create.
    return {
      adminEmail: process.env.TEST_ADMIN_EMAIL,
      adminPassword: process.env.TEST_ADMIN_PASSWORD,
      responderEmail: process.env.TEST_RESPONDER_EMAIL,
      responderPassword: process.env.TEST_RESPONDER_PASSWORD,
    };
  }

  console.log("\nAuto-provisioning temporary test users (no TEST_* env vars found)…");

  const ts = Date.now();
  const adminEmail = `smoke-admin-${ts}@sagip.test`;
  const adminPassword = `Smoke@${ts}Admin!`;
  const responderEmail = `smoke-responder-${ts}@sagip.test`;
  const responderPassword = `Smoke@${ts}Resp!`;

  // Create admin user
  const { data: adminData, error: adminErr } = await db.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });
  if (adminErr) throw new Error(`Failed to create temp admin: ${adminErr.message}`);
  created.tempUsers.push(adminData.user.id);
  const { error: adminProfileErr } = await db.from("profiles").upsert({
    id: adminData.user.id,
    role: "admin",
    full_name: "Smoke Admin (temp)",
  });
  if (adminProfileErr) throw new Error(`Failed to upsert admin profile: ${adminProfileErr.message}`);

  // Create responder user
  const { data: responderData, error: responderErr } = await db.auth.admin.createUser({
    email: responderEmail,
    password: responderPassword,
    email_confirm: true,
  });
  if (responderErr) throw new Error(`Failed to create temp responder: ${responderErr.message}`);
  created.tempUsers.push(responderData.user.id);
  const { error: responderProfileErr } = await db.from("profiles").upsert({
    id: responderData.user.id,
    role: "responder",
    full_name: "Smoke Responder (temp)",
  });
  if (responderProfileErr) throw new Error(`Failed to upsert responder profile: ${responderProfileErr.message}`);

  console.log(`  admin:     ${adminEmail}`);
  console.log(`  responder: ${responderEmail}`);

  return { adminEmail, adminPassword, responderEmail, responderPassword };
}

// ---------------------------------------------------------------------------
// Main test flow
// ---------------------------------------------------------------------------
async function main() {
  const creds = await provisionTestUsers();

  // Auth
  let r = await admin("POST", "/api/auth/login", { email: creds.adminEmail, password: creds.adminPassword });
  check("admin login -> 200 with role admin", r.status === 200 && r.json?.role === "admin", short({ status: r.status, role: r.json?.role, error: r.json?.error }));
  r = await responder("POST", "/api/auth/login", { email: creds.responderEmail, password: creds.responderPassword });
  check("responder login -> 200 with role responder", r.status === 200 && r.json?.role === "responder", short({ status: r.status, role: r.json?.role, error: r.json?.error }));
  created.responderId = r.json?.id;
  r = await admin("POST", "/api/auth/login", { email: creds.adminEmail, password: "definitely-wrong-password" });
  check("wrong password -> 401", r.status === 401, String(r.status));
  r = await admin("POST", "/api/auth/login", {});
  check("login without body fields -> 400", r.status === 400, String(r.status));
  r = await admin("POST", "/api/auth/login", { email: creds.adminEmail, password: creds.adminPassword });
  r = await admin("GET", "/api/auth/me");
  check("admin /me -> 200", r.status === 200 && r.json?.role === "admin", short(r.json));
  if (results.some((x) => !x.ok && x.name.includes("login -> 200"))) throw new Error("Login failed; stopping");

  // ── Unauthenticated (anon) 401 checks ─────────────────────────────────────
  // We need a placeholder incident ID for action endpoints; use a nil UUID.
  // The auth guard must reject before it ever touches the DB.
  const nilId = "00000000-0000-0000-0000-000000000000";
  const anonChecks = [
    ["GET",  "/api/incidents"],
    ["GET",  "/api/incidents/map"],
    ["GET",  "/api/review-queue"],
    ["GET",  "/api/teams"],
    ["POST", `/api/reports/${nilId}/review`],
    ["POST", `/api/incidents/${nilId}/assign`],
    ["PATCH",`/api/incidents/${nilId}/status`],
    ["PATCH",`/api/incidents/${nilId}/priority`],
    ["POST", `/api/incidents/${nilId}/reclassify`],
  ];
  console.log("\nAnon 401 checks…");
  for (const [method, path] of anonChecks) {
    r = await anon(method, path, method !== "GET" ? {} : undefined);
    check(`anon ${method} ${path} -> 401`, r.status === 401, String(r.status));
  }

  // Reference data
  r = await responder("GET", "/api/teams");
  const teams = r.json?.items ?? [];
  check("GET /api/teams -> seeded teams", r.status === 200 && teams.length >= 4, `${teams.length} teams`);
  r = await responder("GET", "/api/areas");
  check("GET /api/areas -> GeoJSON FeatureCollection", r.status === 200 && r.json?.type === "FeatureCollection" && r.json.features?.length >= 1, `${r.json?.features?.length} areas`);

  // New reports
  console.log("\nSubmitting 2 reports and waiting for classification...");
  const fire = await submitReport("Sunog sa balay sa among silingan, naay patay", 10.32, 123.88);
  const prank = await submitReport("Baha abot tuhod sa dalan", 10.29, 123.88);
  console.log(`  ${fire.trackingCode}: ${fire.status}   ${prank.trackingCode}: ${prank.status}`);
  const { data: cls } = await db.from("classifications").select("report_id, model, incident_type, severity, confidence").in("report_id", [fire.id, prank.id]);
  console.log("  classifications:", short(cls));

  // Review queue
  r = await responder("GET", "/api/review-queue");
  const queued = (r.json?.items ?? []).map((i) => i.id);
  check("GET /api/review-queue -> 200", r.status === 200, `${queued.length} items`);
  for (const rep of [fire, prank]) {
    if (rep.status === "pending_review") check(`review queue contains ${rep.trackingCode}`, queued.includes(rep.id));
  }
  if (fire.status !== "pending_review") {
    // AI was confident; force it back into review so the review flow can be tested.
    await db.from("reports").update({ status: "pending_review", confirmed_type: null, confirmed_severity: null }).eq("id", fire.id);
    await db.from("priority_scores").delete().eq("report_id", fire.id);
    console.log(`  (moved ${fire.trackingCode} back to pending_review for testing)`);
  }
  if (prank.status !== "pending_review") {
    await db.from("reports").update({ status: "pending_review", confirmed_type: null, confirmed_severity: null }).eq("id", prank.id);
    await db.from("priority_scores").delete().eq("report_id", prank.id);
  }

  // Review
  r = await responder("POST", `/api/reports/${fire.id}/review`, { finalType: "explosion", finalSeverity: "high" });
  check("review with invalid type -> 400", r.status === 400, String(r.status));
  r = await responder("POST", `/api/reports/${fire.id}/review`, { finalType: "fire", finalSeverity: "critical", notes: "smoke test" });
  check("responder confirms review -> 200 classified with priority", r.status === 200 && r.json?.status === "classified" && typeof r.json?.priority?.score === "number", short(r.json));
  r = await responder("POST", `/api/reports/${fire.id}/review`, { finalType: "fire", finalSeverity: "critical" });
  check("second review of same report -> 409", r.status === 409, String(r.status));
  r = await admin("POST", `/api/reports/${prank.id}/review`, { reject: true, notes: "smoke test reject" });
  check("reject review -> 200 rejected, no priority", r.status === 200 && r.json?.status === "rejected" && r.json?.priority === null, short(r.json));

  // Incidents list + detail
  r = await responder("GET", "/api/incidents");
  const listed = r.json?.items?.find((i) => i.id === fire.id);
  check("GET /api/incidents -> includes reviewed report with score", r.status === 200 && !!listed?.priority, short(listed));
  const scores = (r.json?.items ?? []).map((i) => i.priority?.score ?? -1);
  check("incidents ranked by score (desc)", scores.every((s, i) => i === 0 || scores[i - 1] >= s), short(scores.slice(0, 10)));
  check("rejected report not in default (open) list", !(r.json?.items ?? []).some((i) => i.id === prank.id));
  r = await responder("GET", "/api/incidents?status=rejected");
  check("filter status=rejected includes rejected report", r.status === 200 && (r.json?.items ?? []).some((i) => i.id === prank.id));
  r = await responder("GET", "/api/incidents?band=P9");
  check("invalid band filter -> 400", r.status === 400, String(r.status));
  r = await responder("GET", `/api/incidents/${fire.id}`);
  check(
    "GET /api/incidents/{id} -> detail with classification, review, audit log",
    r.status === 200 && r.json?.classifications?.length >= 1 && r.json?.review?.finalSeverity === "critical" && r.json?.auditLog?.length >= 2,
    short({ status: r.json?.status, classifications: r.json?.classifications?.length, review: r.json?.review, audit: r.json?.auditLog?.map((a) => a.action) }),
  );
  r = await responder("GET", "/api/incidents/00000000-0000-0000-0000-000000000000");
  check("unknown incident -> 404", r.status === 404, String(r.status));

  // Map
  r = await responder("GET", "/api/incidents/map");
  check("GET /api/incidents/map -> GeoJSON with the incident", r.status === 200 && r.json?.type === "FeatureCollection" && r.json.features.some((f) => f.id === fire.id), `${r.json?.features?.length} features`);
  const feature = r.json?.features?.find((f) => f.id === fire.id);
  check("map point coordinates are [lng, lat]", feature?.geometry?.coordinates?.[0] === 123.88 && feature?.geometry?.coordinates?.[1] === 10.32, short(feature?.geometry));
  r = await responder("GET", "/api/incidents/map?bbox=123.87,10.31,123.90,10.34");
  check("bbox containing the incident includes it", r.status === 200 && r.json.features.some((f) => f.id === fire.id));
  r = await responder("GET", "/api/incidents/map?bbox=0,0,1,1");
  check("bbox elsewhere excludes it", r.status === 200 && !r.json.features.some((f) => f.id === fire.id));
  r = await responder("GET", "/api/incidents/map?bbox=abc");
  check("invalid bbox -> 400", r.status === 400, String(r.status));

  // Assignment
  const team = teams[0];
  r = await responder("POST", `/api/incidents/${fire.id}/assign`, { teamId: team.id });
  check("responder cannot assign -> 403", r.status === 403, String(r.status));
  r = await admin("POST", `/api/incidents/${fire.id}/assign`, { teamId: "00000000-0000-0000-0000-000000000000" });
  check("assign unknown team -> 404", r.status === 404, String(r.status));
  r = await admin("POST", `/api/incidents/${fire.id}/assign`, { teamId: team.id });
  check("admin assigns team -> 201 assigned", r.status === 201 && r.json?.status === "assigned", short(r.json));

  // Status
  r = await responder("PATCH", `/api/incidents/${fire.id}/status`, { status: "in_progress" });
  check("responder not on assigned team -> 403", r.status === 403, String(r.status));

  const { data: prof } = await db.from("profiles").select("team_id").eq("id", created.responderId).single();
  created.responderTeamBefore = prof?.team_id ?? null;
  await db.from("profiles").update({ team_id: team.id }).eq("id", created.responderId);

  r = await responder("PATCH", `/api/incidents/${fire.id}/status`, { status: "resolved" });
  check("invalid transition assigned -> resolved -> 409", r.status === 409, short(r.json));
  r = await responder("PATCH", `/api/incidents/${fire.id}/status`, { status: "in_progress" });
  check("team responder: assigned -> in_progress", r.status === 200 && r.json?.status === "in_progress", short(r.json));
  r = await responder("PATCH", `/api/incidents/${fire.id}/status`, { status: "rejected" });
  check("responder cannot reject -> 403", r.status === 403, String(r.status));
  r = await responder("PATCH", `/api/incidents/${fire.id}/status`, { status: "resolved", notes: "smoke test" });
  check("team responder: in_progress -> resolved", r.status === 200 && r.json?.status === "resolved", short(r.json));
  r = await admin("PATCH", `/api/incidents/${fire.id}/status`, { status: "in_progress" });
  check("admin reopens: resolved -> in_progress", r.status === 200, short(r.json));

  // Priority override
  r = await responder("PATCH", `/api/incidents/${fire.id}/priority`, { band: "P1", reason: "test" });
  check("responder cannot override priority -> 403", r.status === 403, String(r.status));
  r = await admin("PATCH", `/api/incidents/${fire.id}/priority`, { band: "P1" });
  check("override without reason -> 400", r.status === 400, String(r.status));
  r = await admin("PATCH", `/api/incidents/${fire.id}/priority`, { score: 91.25, reason: "smoke test" });
  check("admin override score -> band derived, overridden", r.status === 200 && r.json?.priority?.band === "P1" && r.json?.priority?.overridden === true, short(r.json));

  // Reclassify
  r = await responder("POST", `/api/incidents/${fire.id}/reclassify`);
  check("responder cannot reclassify -> 403", r.status === 403, String(r.status));
  r = await admin("POST", `/api/incidents/${fire.id}/reclassify`);
  check("reclassify in_progress incident -> 409", r.status === 409, String(r.status));
  const { data: before } = await db.from("reports").select("status").eq("id", prank.id).single();
  await db.from("reports").update({ status: "classified" }).eq("id", prank.id); // reviewed (rejected) report, make reclassifiable
  const { count: reviewCount } = await db.from("reviews").select("id", { count: "exact", head: true }).eq("report_id", prank.id);
  r = await admin("POST", `/api/incidents/${prank.id}/reclassify`);
  check(
    "admin reclassify -> 200 with chain attempts",
    r.status === 200 && Array.isArray(r.json?.classification?.attempts),
    short({ status: r.json?.status, kept: r.json?.keptHumanReview, model: r.json?.classification?.model, step: r.json?.classification?.step, attempts: r.json?.classification?.attempts?.map((a) => `${a.step}:${a.ok ? "ok" : a.error?.status ?? a.error?.name}`) }),
  );
  if (reviewCount === 0) console.log("  (note: rejected reports have no review row, so reclassify re-routes them)");
  await db.from("reports").update({ status: before.status }).eq("id", prank.id);

  // Logout
  r = await responder("POST", "/api/auth/logout");
  check("logout -> 204", r.status === 204, String(r.status));
  r = await responder("GET", "/api/auth/me");
  check("after logout /me -> 401", r.status === 401, String(r.status));
}

try {
  await main();
} catch (err) {
  check("script completed", false, err instanceof Error ? err.message : String(err));
} finally {
  // ── Restore responder's team membership ───────────────────────────────────
  if (created.responderId && created.responderTeamBefore !== undefined) {
    await db.from("profiles").update({ team_id: created.responderTeamBefore }).eq("id", created.responderId);
  }

  // ── Delete test reports (unless SMOKE_KEEP_REPORTS=1) ─────────────────────
  if (created.reports.length && process.env.SMOKE_KEEP_REPORTS !== "1") {
    // Cascade-delete any priority_scores, classifications, reviews, and audit_log rows first.
    // The DB schema should handle this via ON DELETE CASCADE, but we belt-and-suspenders here.
    await db.from("priority_scores").delete().in("report_id", created.reports);
    await db.from("classifications").delete().in("report_id", created.reports);
    await db.from("reviews").delete().in("report_id", created.reports);
    await db.from("audit_log").delete().in("report_id", created.reports);
    const { error: delErr } = await db.from("reports").delete().in("id", created.reports);
    if (delErr) console.warn("  Warning: could not delete some test reports:", delErr.message);
    else console.log(`\nCleaned up ${created.reports.length} test report(s).`);
  } else if (created.reports.length) {
    console.log("\nTest report ids (kept):", JSON.stringify(created.reports));
  }

  // ── Delete temporary auth users (and their profiles) ─────────────────────
  for (const uid of created.tempUsers) {
    await db.from("profiles").delete().eq("id", uid);
    const { error } = await db.auth.admin.deleteUser(uid);
    if (error) console.warn(`  Warning: could not delete temp user ${uid}:`, error.message);
  }
  if (created.tempUsers.length) console.log(`Deleted ${created.tempUsers.length} temporary auth user(s).`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((x) => x.ok).length;
  console.log(`\n${passed}/${results.length} passed`);
  const failed = results.filter((x) => !x.ok).map((x) => x.name);
  if (failed.length) console.log("FAILED:", JSON.stringify(failed));
  process.exitCode = failed.length ? 1 : 0;
}
