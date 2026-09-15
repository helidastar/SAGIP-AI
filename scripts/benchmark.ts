/**
 * AI classification benchmark (DOCUMENTATION.md Appendix B).
 *
 * Usage:
 *   npm run benchmark -- --dry-run
 *   npm run benchmark -- --models gemini:gemini-3.6-flash,claude:claude-haiku-4-5 --yes
 *
 * Options:
 *   --dataset <dir>     Folder with labels.csv and images (default benchmark/dataset)
 *   --models <list>     provider:model pairs, comma-separated (default gemini:gemini-3.6-flash)
 *   --limit <n>         Only use the first n labeled rows
 *   --concurrency <n>   Parallel requests per model (default 2)
 *   --dry-run           Validate the dataset and print the plan without calling any API
 *   --yes               Required to make paid API calls
 *
 * API keys: GEMINI_API_KEY, ANTHROPIC_API_KEY, or AI_API_KEY for the provider named in AI_PROVIDER.
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClaudeClassifier } from "@/lib/ai/claude";
import { createGeminiClassifier } from "@/lib/ai/gemini";
import { needsReview } from "@/lib/ai/review";
import type { Classifier, ClassifierResult } from "@/lib/ai/types";
import { INCIDENT_TYPES, SEVERITY } from "@/lib/constants";
import type { IncidentType, Severity } from "@/types";

const WEIGHTS = { typeAccuracy: 0.35, severityWithinOne: 0.25, confidence: 0.15, cost: 0.15, latency: 0.1 };
const TIMEOUT_MS = 60_000;
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

interface Label {
  file: string;
  description: string;
  incidentType: IncidentType;
  severity: Severity;
  bucket: string;
}

interface Run {
  model: string;
  file: string;
  bucket: string;
  expected: { incidentType: IncidentType; severity: Severity };
  result?: Omit<ClassifierResult, "raw">;
  error?: string;
}

const { values: args } = parseArgs({
  options: {
    dataset: { type: "string", default: "benchmark/dataset" },
    models: { type: "string", default: "gemini:gemini-3.6-flash" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "2" },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
});

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

async function loadLabels(dir: string): Promise<Label[]> {
  const [header, ...rows] = parseCsv((await readFile(path.join(dir, "labels.csv"), "utf8")).replace(/^﻿/, ""));
  const col = (name: string) => header.map((h) => h.trim()).indexOf(name);
  const idx = { file: col("file"), description: col("description"), incidentType: col("incidentType"), severity: col("severity"), bucket: col("bucket") };
  if (idx.file < 0 || idx.incidentType < 0 || idx.severity < 0) {
    throw new Error("labels.csv needs columns: file, description, incidentType, severity, bucket");
  }

  const labels: Label[] = [];
  const problems: string[] = [];
  for (const [n, r] of rows.entries()) {
    const line = n + 2;
    const file = r[idx.file]?.trim();
    const incidentType = r[idx.incidentType]?.trim() as IncidentType;
    const severity = r[idx.severity]?.trim() as Severity;
    if (!file) { problems.push(`line ${line}: missing file`); continue; }
    if (!INCIDENT_TYPES.includes(incidentType)) problems.push(`line ${line}: invalid incidentType "${incidentType}"`);
    if (!(severity in SEVERITY)) problems.push(`line ${line}: invalid severity "${severity}"`);
    if (!MIME[path.extname(file).toLowerCase()]) problems.push(`line ${line}: unsupported image type "${file}"`);
    try { await stat(path.join(dir, file)); } catch { problems.push(`line ${line}: file not found "${file}"`); }
    labels.push({
      file,
      description: idx.description >= 0 ? r[idx.description]?.trim() ?? "" : "",
      incidentType,
      severity,
      bucket: (idx.bucket >= 0 && r[idx.bucket]?.trim()) || incidentType,
    });
  }
  if (problems.length) throw new Error(`Dataset problems:\n  ${problems.join("\n  ")}`);
  return labels;
}

function makeClassifier(spec: string): Classifier {
  const [provider, ...rest] = spec.split(":");
  const model = rest.join(":") || undefined;
  const envKey = (name: string) => process.env[name] || (process.env.AI_PROVIDER === provider ? process.env.AI_API_KEY : undefined);
  if (provider === "gemini") {
    const key = envKey("GEMINI_API_KEY");
    if (!key) throw new Error("Set GEMINI_API_KEY to benchmark Gemini");
    return createGeminiClassifier(key, model);
  }
  if (provider === "claude") {
    const key = envKey("ANTHROPIC_API_KEY");
    if (!key) throw new Error("Set ANTHROPIC_API_KEY to benchmark Claude");
    return createClaudeClassifier(key, model);
  }
  throw new Error(`Unknown provider "${provider}" in --models (use gemini:<model> or claude:<model>)`);
}

async function runModel(classifier: Classifier, labels: Label[], dir: string, concurrency: number, log: (r: Run) => Promise<void>) {
  const runs: Run[] = [];
  let next = 0;
  async function worker() {
    while (next < labels.length) {
      const label = labels[next++];
      const run: Run = { model: classifier.model, file: label.file, bucket: label.bucket, expected: { incidentType: label.incidentType, severity: label.severity } };
      try {
        const data = await readFile(path.join(dir, label.file));
        const signal = AbortSignal.timeout(TIMEOUT_MS);
        const full = await classifier.classify(
          { image: { data, mimeType: MIME[path.extname(label.file).toLowerCase()] }, description: label.description },
          { signal },
        );
        const { raw, ...result } = full;
        void raw;
        run.result = result;
      } catch (err) {
        run.error = err instanceof Error ? err.message : String(err);
      }
      runs.push(run);
      await log(run);
      process.stdout.write(run.error ? "x" : ".");
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, labels.length) }, worker));
  process.stdout.write("\n");
  return runs;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
};

function summarize(model: string, runs: Run[]) {
  const ok = runs.filter((r): r is Run & { result: NonNullable<Run["result"]> } => !!r.result);
  const typeCorrect = ok.filter((r) => r.result.incidentType === r.expected.incidentType);
  const sevDiff = (r: (typeof ok)[number]) => Math.abs(SEVERITY[r.result.severity] - SEVERITY[r.expected.severity]);

  // Confidence reliability: Brier score of confidence vs. type correctness (0 = perfect, 1 = worst).
  const brier = mean(ok.map((r) => (r.result.confidence - (r.result.incidentType === r.expected.incidentType ? 1 : 0)) ** 2));

  // Safety: truly high/critical incidents the AI under-rated AND would have skipped human review.
  const missedUrgent = ok.filter((r) =>
    SEVERITY[r.expected.severity] >= SEVERITY.high &&
    SEVERITY[r.result.severity] < SEVERITY.high &&
    !needsReview(r.result),
  );

  const costs = ok.map((r) => r.result.costUsd).filter((c): c is number => c !== null);
  const latencies = ok.map((r) => r.result.latencyMs);

  const confusion: Record<string, Record<string, number>> = {};
  for (const r of ok) {
    confusion[r.expected.incidentType] ??= {};
    confusion[r.expected.incidentType][r.result.incidentType] = (confusion[r.expected.incidentType][r.result.incidentType] ?? 0) + 1;
  }

  const byBucket: Record<string, { total: number; typeCorrect: number }> = {};
  for (const r of ok) {
    byBucket[r.bucket] ??= { total: 0, typeCorrect: 0 };
    byBucket[r.bucket].total++;
    if (r.result.incidentType === r.expected.incidentType) byBucket[r.bucket].typeCorrect++;
  }

  return {
    model,
    total: runs.length,
    errors: runs.length - ok.length,
    errorRate: runs.length ? (runs.length - ok.length) / runs.length : 0,
    typeAccuracy: ok.length ? typeCorrect.length / ok.length : 0,
    severityExact: ok.length ? ok.filter((r) => sevDiff(r) === 0).length / ok.length : 0,
    severityWithinOne: ok.length ? ok.filter((r) => sevDiff(r) <= 1).length / ok.length : 0,
    brier,
    meanConfidenceCorrect: mean(typeCorrect.map((r) => r.result.confidence)),
    meanConfidenceWrong: mean(ok.filter((r) => r.result.incidentType !== r.expected.incidentType).map((r) => r.result.confidence)),
    reviewRate: ok.length ? ok.filter((r) => needsReview(r.result)).length / ok.length : 0,
    missedUrgent: missedUrgent.map((r) => r.file),
    meanCostUsd: costs.length ? mean(costs) : null,
    totalCostUsd: costs.reduce((a, b) => a + b, 0),
    meanLatencyMs: Math.round(mean(latencies)),
    p95LatencyMs: percentile(latencies, 0.95),
    byBucket,
    confusion,
    weightedScore: 0,
  };
}

type Summary = ReturnType<typeof summarize>;

/** Appendix B.4 weighted score (0–100). Cost and latency are scored relative to the best model in this run. */
function applyWeightedScores(summaries: Summary[]) {
  const minCost = Math.min(...summaries.map((s) => s.meanCostUsd ?? Infinity));
  const minLatency = Math.min(...summaries.map((s) => s.meanLatencyMs || Infinity));
  for (const s of summaries) {
    // Errors count against accuracy: a failed call is a wrong answer in production.
    const success = 1 - s.errorRate;
    const costScore = s.meanCostUsd && Number.isFinite(minCost) ? minCost / s.meanCostUsd : s.meanCostUsd === 0 ? 1 : 0;
    const latencyScore = s.meanLatencyMs && Number.isFinite(minLatency) ? minLatency / s.meanLatencyMs : 0;
    s.weightedScore = Math.round(100 * (
      WEIGHTS.typeAccuracy * s.typeAccuracy * success +
      WEIGHTS.severityWithinOne * s.severityWithinOne * success +
      WEIGHTS.confidence * (1 - s.brier) * success +
      WEIGHTS.cost * costScore +
      WEIGHTS.latency * latencyScore
    ) * 10) / 10;
  }
}

function report(summaries: Summary[], meta: { dataset: string; images: number; startedAt: string }) {
  const lines = [
    `# AI Classification Benchmark`,
    ``,
    `- Started: ${meta.startedAt}`,
    `- Dataset: \`${meta.dataset}\` (${meta.images} images)`,
    `- Weights (Appendix B.4): type ${WEIGHTS.typeAccuracy * 100}%, severity ±1 ${WEIGHTS.severityWithinOne * 100}%, confidence ${WEIGHTS.confidence * 100}%, cost ${WEIGHTS.cost * 100}%, latency ${WEIGHTS.latency * 100}%`,
    ``,
    `> Small dataset: results are directional, not statistically rigorous.`,
    ``,
    `## Summary`,
    ``,
    `| Model | Score | Type acc. | Severity exact | Severity ±1 | Brier ↓ | Conf. right / wrong | Review rate | Missed urgent ↓ | Errors | Mean cost | Mean / p95 latency |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|`,
    ...[...summaries].sort((a, b) => b.weightedScore - a.weightedScore).map((s) =>
      `| ${s.model} | **${s.weightedScore}** | ${pct(s.typeAccuracy)} | ${pct(s.severityExact)} | ${pct(s.severityWithinOne)} | ${s.brier.toFixed(3)} | ${s.meanConfidenceCorrect.toFixed(2)} / ${s.meanConfidenceWrong.toFixed(2)} | ${pct(s.reviewRate)} | ${s.missedUrgent.length} | ${s.errors} | ${s.meanCostUsd === null ? "n/a" : `$${s.meanCostUsd.toFixed(5)}`} | ${s.meanLatencyMs} / ${s.p95LatencyMs} ms |`,
    ),
    ``,
    `**Missed urgent** = truly high/critical incidents the model rated low/moderate with enough confidence to skip human review. This should be 0.`,
  ];

  for (const s of summaries) {
    lines.push(``, `## ${s.model}`, ``, `### Accuracy by bucket`, ``, `| Bucket | Correct type |`, `|---|---|`);
    for (const [bucket, b] of Object.entries(s.byBucket).sort()) lines.push(`| ${bucket} | ${b.typeCorrect}/${b.total} (${pct(b.typeCorrect / b.total)}) |`);

    const predicted = [...new Set(Object.values(s.confusion).flatMap((row) => Object.keys(row)))].sort();
    lines.push(``, `### Confusion matrix (rows = expected, columns = predicted)`, ``, `| | ${predicted.join(" | ")} |`, `|---|${predicted.map(() => "---").join("|")}|`);
    for (const [expected, row] of Object.entries(s.confusion).sort()) {
      lines.push(`| **${expected}** | ${predicted.map((p) => row[p] ?? "").join(" | ")} |`);
    }
    if (s.missedUrgent.length) lines.push(``, `Missed urgent: ${s.missedUrgent.map((f) => `\`${f}\``).join(", ")}`);
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const dir = path.resolve(args.dataset!);
  const labels = (await loadLabels(dir)).slice(0, args.limit ? Number(args.limit) : undefined);
  const specs = args.models!.split(",").map((s) => s.trim()).filter(Boolean);
  const concurrency = Math.max(1, Number(args.concurrency) || 2);

  const buckets = labels.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.bucket]: (acc[l.bucket] ?? 0) + 1 }), {});
  console.log(`Dataset OK: ${labels.length} images`);
  console.log(`Buckets: ${Object.entries(buckets).map(([b, n]) => `${b}=${n}`).join(", ")}`);
  console.log(`Models: ${specs.join(", ")} → ${labels.length * specs.length} API calls`);

  if (args["dry-run"]) return;
  if (!args.yes) {
    console.log("\nThis makes paid API calls. Re-run with --yes to proceed (or --dry-run to only validate).");
    process.exitCode = 1;
    return;
  }

  const classifiers = specs.map(makeClassifier);
  const startedAt = new Date().toISOString();
  const outDir = path.resolve("benchmark/results", startedAt.replace(/[:.]/g, "-"));
  await mkdir(outDir, { recursive: true });
  const runsFile = path.join(outDir, "runs.jsonl");
  await writeFile(runsFile, "");
  const log = async (r: Run) => writeFile(runsFile, JSON.stringify(r) + "\n", { flag: "a" });

  const summaries: Summary[] = [];
  for (const classifier of classifiers) {
    console.log(`\n${classifier.model}`);
    summaries.push(summarize(classifier.model, await runModel(classifier, labels, dir, concurrency, log)));
  }
  applyWeightedScores(summaries);

  const md = report(summaries, { dataset: args.dataset!, images: labels.length, startedAt });
  await writeFile(path.join(outDir, "summary.json"), JSON.stringify(summaries, null, 2));
  await writeFile(path.join(outDir, "report.md"), md);
  console.log(`\n${md.split("## Summary")[1].split("\n## ")[0].trim()}`);
  console.log(`\nSaved to ${path.relative(process.cwd(), outDir)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
