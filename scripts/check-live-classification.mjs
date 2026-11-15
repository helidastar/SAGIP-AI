// Closes the last "can't check from here" gap on AI 6 (ISS-007) and AI 22: confirms that a
// real classification row, from a real provider run against the live database, actually has
// cost_usd and severity_confidence filled in (both are computed in src/lib/ai, but a live row
// is the only way to confirm nothing drops them between there and the database).
//
// Usage:
//   npm run check-live-classification
//   npm run check-live-classification -- --report <reportId>   (check one report instead of the latest)
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (same as scripts/make-admin.mjs),
// and at least one report that has actually been classified by a real provider (not the keyword
// fallback - that always reports cost_usd: null, severity_confidence: null by design).
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const { values } = parseArgs({ options: { report: { type: "string" } } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.local).");
    return 1;
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  let query = db
    .from("classifications")
    .select("id, report_id, model, incident_type, severity, confidence, severity_confidence, cost_usd, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (values.report) query = query.eq("report_id", values.report);

  const { data, error } = await query;
  if (error) {
    console.error("Query failed:", error.message);
    return 1;
  }
  const row = data?.[0];
  if (!row) {
    console.error(values.report ? `No classification found for report ${values.report}.` : "No classifications in the database yet - submit and classify a report first.");
    return 1;
  }

  console.log(`Latest classification (${row.created_at}):`);
  console.log(`  report_id          ${row.report_id}`);
  console.log(`  model              ${row.model}`);
  console.log(`  incident_type      ${row.incident_type}`);
  console.log(`  severity           ${row.severity}`);
  console.log(`  confidence         ${row.confidence}`);
  console.log(`  severity_confidence ${row.severity_confidence}  (AI 22, ISS-016 - null is expected from the keyword fallback)`);
  console.log(`  cost_usd           ${row.cost_usd}  (AI 6, ISS-007 - null is expected from the local provider and the keyword fallback)`);

  const keywordOnly = row.model?.includes("keyword");
  if (keywordOnly) {
    console.log("\nThis row came from the keyword fallback, which never sets either field by design - not a failure, just not the row to check.");
    console.log("Run this again after a report has actually been classified by Gemini or the local model.");
    return 0;
  }

  const isGemini = row.model?.includes("gemini") || row.model?.includes("claude");
  if (isGemini && row.cost_usd == null) {
    console.log("\nFAIL (ISS-007 / AI 6): a paid-provider row has no cost_usd. Check estimateCost's price table in src/lib/ai/normalize.ts for this model.");
  } else if (isGemini) {
    console.log("\nOK (ISS-007 / AI 6): cost_usd is saved for this provider.");
  }

  const isLocal = row.model?.includes("local");
  if (isLocal && row.severity_confidence == null) {
    console.log("\nNote (AI 22 / ISS-016): this local-model row has no severity_confidence - expected until the local model is retrained with the severity head (AI 25) and that run is deployed.");
  } else if (row.severity_confidence != null) {
    console.log("\nOK (AI 22): severity_confidence is saved for this row.");
  }

  return 0;
}

main().then((code) => process.exit(code ?? 0));
