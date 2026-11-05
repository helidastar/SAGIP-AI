/**
 * Weak-label severity for training photos using Gemini (AI 25 / ISS-016, design doc
 * docs/local-severity-design.md, "What is still needed" item 1).
 *
 * The design doc's plan was to hand-label ~150+ photos per severity tier with the same
 * 3-labeler method used for the 50-photo benchmark. That's the right way to get truly
 * reliable labels, but it's slow, and under the Nov 24 defense deadline there may not be
 * time to do it by hand for the whole training set. This script instead asks Gemini
 * (already measured at 58.5% severity-exact-match / 95.1% within one tier, per the
 * 2026-11-03 benchmark) to produce WEAK severity labels fast, so training can start now.
 *
 * These are NOT a substitute for the human-verified plan - they're noisier. Before
 * trusting a training run on them, spot-check a random sample (50+, weighted toward
 * "critical" since that's the costliest tier to mislabel) against what a person would say.
 * If accuracy checks out, use as-is; if not, this still cuts the hand-labeling job down to
 * fixing a sample instead of starting from zero.
 *
 * Usage:
 *   npm run label-severity -- --dataset training/dataset --target-per-tier 150 --yes
 *
 * Options:
 *   --dataset <dir>          ImageFolder-style root (default training/dataset)
 *   --out <file>             Output CSV (default <dataset>/severity.csv)
 *   --target-per-tier <n>    Stop once every tier has at least this many labels (default 150)
 *   --max-calls <n>          Hard cap on Gemini calls this run, safety net (default 2000)
 *   --model <name>           Gemini model (default gemini-3.1-flash-lite, the team's fallback)
 *   --dry-run                Print the sampling plan, make no API calls
 *   --yes                    Required to make real API calls
 *
 * Resumable: files already in the output CSV are skipped and counted toward the tally,
 * so a run that's interrupted (or rate-limited) can just be started again.
 *
 * API key: GEMINI_API_KEY (same as scripts/benchmark.ts).
 */
import { mkdir, readdir, readFile, writeFile, appendFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createGeminiClassifier } from "@/lib/ai/gemini";
import { SEVERITY } from "@/lib/constants";

const TIERS = Object.keys(SEVERITY) as (keyof typeof SEVERITY)[]; // low, moderate, high, critical
const EXPECTED_CLASSES = [
  "fire", "flood", "landslide", "road_accident",
  "structural_damage", "medical_emergency", "fallen_debris", "other",
];
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const { values: args } = parseArgs({
  options: {
    dataset: { type: "string", default: "training/dataset" },
    out: { type: "string" },
    "target-per-tier": { type: "string", default: "150" },
    "max-calls": { type: "string", default: "2000" },
    model: { type: "string", default: "gemini-3.1-flash-lite" },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
});

const datasetDir = path.resolve(args.dataset!);
const outFile = path.resolve(args.out ?? path.join(datasetDir, "severity.csv"));
const targetPerTier = Number(args["target-per-tier"]);
const maxCalls = Number(args["max-calls"]);

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  // 1. Gather all candidate files, round-robin across type folders for variety.
  const perClass: string[][] = [];
  for (const cls of EXPECTED_CLASSES) {
    const dir = path.join(datasetDir, cls);
    try {
      const files = (await readdir(dir)).filter((f) => MIME[path.extname(f).toLowerCase()]);
      perClass.push(seededShuffle(files.map((f) => path.join(cls, f)), 42));
    } catch {
      perClass.push([]);
    }
  }
  const candidates: string[] = [];
  for (let i = 0; ; i++) {
    let any = false;
    for (const list of perClass) if (list[i]) { candidates.push(list[i]); any = true; }
    if (!any) break;
  }

  // 2. Load existing labels (resume support) and tally.
  const tally: Record<string, number> = Object.fromEntries(TIERS.map((t) => [t, 0]));
  const already = new Set<string>();
  try {
    const existing = await readFile(outFile, "utf8");
    for (const line of existing.trim().split("\n").slice(1)) {
      const [file, severity] = line.split(",");
      if (file && severity && TIERS.includes(severity as keyof typeof SEVERITY)) {
        already.add(file);
        tally[severity]++;
      }
    }
  } catch {
    // no existing file yet
  }

  const remaining = candidates.filter((f) => !already.has(f));
  console.log(`Dataset: ${candidates.length} photos found, ${already.size} already labeled.`);
  console.log("Current tally:", tally);

  if (args["dry-run"]) {
    console.log(`Dry run - would label up to ${Math.min(remaining.length, maxCalls)} more photos, stopping once every tier has ${targetPerTier}.`);
    return;
  }
  if (!args.yes) {
    console.error("Pass --yes to make real Gemini calls (this costs free-tier quota / a small amount if billed).");
    process.exit(1);
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Set GEMINI_API_KEY.");
    process.exit(1);
  }

  await mkdir(path.dirname(outFile), { recursive: true });
  const isNew = !(await stat(outFile).catch(() => null));
  if (isNew) await writeFile(outFile, "file,severity\n");

  const classifier = createGeminiClassifier(apiKey, args.model!);
  let calls = 0;

  for (const rel of remaining) {
    if (TIERS.every((t) => tally[t] >= targetPerTier)) {
      console.log("Every tier has reached the target. Stopping.");
      break;
    }
    if (calls >= maxCalls) {
      console.log(`Hit --max-calls (${maxCalls}). Stopping for now - re-run to continue.`);
      break;
    }
    const full = path.join(datasetDir, rel);
    const ext = path.extname(rel).toLowerCase();
    try {
      const data = await readFile(full);
      const res = await classifier.classify({ image: { data, mimeType: MIME[ext] }, description: "" });
      await appendFile(outFile, `${rel},${res.severity}\n`);
      tally[res.severity] = (tally[res.severity] ?? 0) + 1;
      calls++;
      if (calls % 25 === 0) console.log(`${calls} labeled this run. Tally:`, tally);
    } catch (err) {
      console.warn(`Skipped ${rel}: ${(err as Error).message}`);
    }
  }

  console.log("\nFinal tally:", tally);
  console.log(`Wrote weak labels to ${outFile}`);
  console.log("Reminder: these are Gemini-generated, not human-verified. Spot-check a sample (critical tier especially) before fully trusting a training run on them.");
}

main();
