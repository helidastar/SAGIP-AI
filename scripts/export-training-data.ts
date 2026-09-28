/**
 * Exports human-reviewed reports into training/raw/<incident_type>/, so real (consented,
 * already-collected) citizen reports grow the training set over time instead of only the
 * one-off public datasets.
 *
 * Usage:
 *   npm run export:training-data -- --dry-run
 *   npm run export:training-data
 *
 * By default only reports with a human review (reviews.final_type) are exported — an AI
 * guess is not a trustworthy label. Pass --include-auto to also export reports the AI
 * classified on its own above --min-confidence, e.g. once you trust the primary provider.
 *
 * Privacy: these are real citizen photos and may show faces or plate numbers. Blur or drop
 * those before training, and never share training/raw outside the team.
 *
 * Safe to run daily/weekly: each photo is written to a filename derived from its tracking
 * code, so re-running only downloads reports it hasn't exported yet.
 *
 * Options:
 *   --out <dir>            Destination (default training/raw)
 *   --include-auto         Also export auto-classified (non-reviewed) reports
 *   --min-confidence <n>   Minimum confidence for --include-auto (default 0.85)
 *   --limit <n>            Stop after exporting this many photos (default: no limit)
 *   --dry-run              Only report what would happen, downloads nothing
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { INCIDENT_TYPES } from "@/lib/constants";
import { createAdminClient, PHOTO_BUCKET } from "@/lib/supabase/admin";

const { values: args } = parseArgs({
  options: {
    out: { type: "string", default: "training/raw" },
    "include-auto": { type: "boolean", default: false },
    "min-confidence": { type: "string", default: "0.85" },
    limit: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const OUT_DIR = args.out!;
const MIN_CONFIDENCE = Number(args["min-confidence"]);
const LIMIT = args.limit ? Number(args.limit) : Infinity;

interface Row {
  id: string;
  tracking_code: string;
  photo_path: string | null;
  status: string;
  confirmed_type: string | null;
  reviews: { final_type: string } | null;
  classifications: { confidence: number; created_at: string }[] | null;
}

async function main() {
  const db = createAdminClient();

  // Supabase caps a request at 1000 rows, so page through until a short page comes back.
  const PAGE = 500;
  const data: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await db
      .from("reports")
      .select(
        "id, tracking_code, photo_path, status, confirmed_type, reviews ( final_type ), classifications ( confidence, created_at )",
      )
      .not("photo_path", "is", null)
      .not("confirmed_type", "is", null)
      .neq("status", "rejected")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1)
      .returns<Row[]>();

    if (error) {
      console.error("Query failed:", error.message);
      process.exit(1);
    }
    data.push(...(page ?? []));
    if (!page || page.length < PAGE) break;
  }

  let exported = 0;
  let skippedExists = 0;
  let skippedUnreviewed = 0;
  let skippedLowConfidence = 0;
  const perType = new Map<string, number>();

  for (const row of data) {
    if (exported >= LIMIT) break;

    const type = row.reviews?.final_type ?? row.confirmed_type;
    if (!type || !INCIDENT_TYPES.includes(type as (typeof INCIDENT_TYPES)[number])) continue;

    if (!row.reviews) {
      if (!args["include-auto"]) {
        skippedUnreviewed++;
        continue;
      }
      // Embedded rows come back unordered, so take the newest classification.
      const latest = [...(row.classifications ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const confidence = latest?.confidence ?? 0;
      if (confidence < MIN_CONFIDENCE) {
        skippedLowConfidence++;
        continue;
      }
    }

    const ext = path.extname(row.photo_path!) || ".jpg";
    const destDir = path.join(OUT_DIR, type);
    const destPath = path.join(destDir, `${row.tracking_code}${ext}`);

    if (await fileExists(destPath)) {
      skippedExists++;
      continue;
    }

    if (args["dry-run"]) {
      exported++;
      perType.set(type, (perType.get(type) ?? 0) + 1);
      continue;
    }

    const { data: blob, error: downloadError } = await db.storage.from(PHOTO_BUCKET).download(row.photo_path!);
    if (downloadError || !blob) {
      console.warn(`  skip ${row.tracking_code}: download failed (${downloadError?.message})`);
      continue;
    }

    await mkdir(destDir, { recursive: true });
    await writeFile(destPath, Buffer.from(await blob.arrayBuffer()));
    exported++;
    perType.set(type, (perType.get(type) ?? 0) + 1);
  }

  console.log(`\n${args["dry-run"] ? "[dry-run] would export" : "Exported"} ${exported} photo(s) to ${OUT_DIR}/`);
  for (const [type, count] of [...perType].sort()) console.log(`  ${type}: ${count}`);
  console.log(`Skipped: ${skippedExists} already exported, ${skippedUnreviewed} not human-reviewed, ${skippedLowConfidence} below confidence threshold`);
  if (!args["include-auto"] && skippedUnreviewed > 0) {
    console.log(`Tip: pass --include-auto --min-confidence ${MIN_CONFIDENCE} to also pull high-confidence auto-classified reports.`);
  }
}

async function fileExists(p: string) {
  try {
    await import("node:fs/promises").then((fs) => fs.access(p));
    return true;
  } catch {
    return false;
  }
}

main();
