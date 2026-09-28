/**
 * Turns raw downloaded photos into a clean training set and a separate benchmark set.
 *
 * Usage:
 *   npm run dataset:prepare -- --dry-run
 *   npm run dataset:prepare
 *
 * Put photos in training/raw/<incident_type>/ (subfolders inside are fine), e.g.
 *   training/raw/flood/kaggle-disasters/img001.jpg
 *
 * Options:
 *   --input <dir>     Raw photos (default training/raw)
 *   --out <dir>       Training set for Colab (default training/dataset)
 *   --holdout <n>     Photos per type moved to benchmark/dataset (default 6, 0 = none)
 *   --max-size <px>   Longest side of the saved photos (default 1024; 512 keeps the Drive upload small)
 *   --dry-run         Only report what would happen
 *   --force           Replace an existing benchmark/dataset/labels.csv (loses hand-filled severities)
 *
 * What it does:
 *   - Skips unreadable files and photos under 128 px
 *   - Removes duplicates, including resized/re-saved copies (perceptual hash)
 *   - Flags the same photo filed under two types (a labeling mistake): both copies are skipped
 *   - Shrinks to 1024 px JPEG (or --max-size) so the Drive upload stays small
 *   - Holds out photos for the benchmark so they are never trained on
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { INCIDENT_TYPES } from "@/lib/constants";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"]);
const MIN_SIDE = 128;
/** Default longest side of saved photos; training only needs 224 px, so --max-size 512 uploads much faster. */
const MAX_SIDE = 1024;
/** Hashes this close (out of 64 bits) are treated as the same photo. */
const NEAR_DUPLICATE_BITS = 4;
const TARGET_PER_TYPE = 100;

const { values: args } = parseArgs({
  options: {
    input: { type: "string", default: "training/raw" },
    out: { type: "string", default: "training/dataset" },
    holdout: { type: "string", default: "6" },
    "max-size": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});

interface Photo {
  type: string;
  file: string;
  hash: string;
  pixels: number;
}

async function listImages(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && IMAGE_EXT.has(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

/** 64-bit difference hash as a "0101…" string: survives resizing, re-compression and small colour changes. */
async function dHash(file: string) {
  const px = await sharp(file, { failOn: "none" }).rotate().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let hash = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) hash += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";
  }
  return hash;
}

const hamming = (a: string, b: string) => {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
};

/** Stable pseudo-random order, so the same holdout is picked on every run. */
const stableKey = (file: string) => createHash("sha1").update(path.basename(file)).digest("hex");

async function main() {
  const input = path.resolve(args.input!);
  const out = path.resolve(args.out!);
  const benchDir = path.resolve("benchmark/dataset");
  const holdout = Math.max(0, Number(args.holdout) || 0);
  const maxSide = Math.max(224, Number(args["max-size"]) || MAX_SIDE);

  const folders = (await readdir(input, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  const unknown = folders.filter((f) => !(INCIDENT_TYPES as readonly string[]).includes(f));
  if (unknown.length) {
    throw new Error(`Folder names must match incident types exactly.\n  Unknown: ${unknown.join(", ")}\n  Allowed: ${INCIDENT_TYPES.join(", ")}`);
  }

  const skipped = { unreadable: 0, tooSmall: 0, duplicate: 0, conflict: 0, inBenchmark: 0 };
  const conflicts: string[] = [];
  const kept: Photo[] = [];

  // When keeping the current benchmark set, its photos must never end up in training too.
  const benchHashes: string[] = [];
  if (holdout === 0) {
    for (const type of INCIDENT_TYPES) {
      const dir = path.join(benchDir, type);
      if (!(await stat(dir).catch(() => null))) continue;
      for (const file of await listImages(dir)) benchHashes.push(await dHash(file).catch(() => ""));
    }
  }

  for (const type of INCIDENT_TYPES) {
    if (!folders.includes(type)) continue;
    for (const file of await listImages(path.join(input, type))) {
      let hash: string, pixels: number;
      try {
        const { width = 0, height = 0 } = await sharp(file, { failOn: "none" }).metadata();
        if (Math.min(width, height) < MIN_SIDE) { skipped.tooSmall++; continue; }
        hash = await dHash(file);
        pixels = width * height;
      } catch {
        skipped.unreadable++;
        continue;
      }
      if (benchHashes.some((h) => h && hamming(h, hash) <= NEAR_DUPLICATE_BITS)) { skipped.inBenchmark++; continue; }
      const match = kept.find((p) => hamming(p.hash, hash) <= NEAR_DUPLICATE_BITS);
      if (!match) { kept.push({ type, file, hash, pixels }); continue; }
      if (match.type === type) {
        // Keep the higher-resolution copy.
        if (pixels > match.pixels) Object.assign(match, { file, hash, pixels });
        skipped.duplicate++;
        continue;
      }
      // Same photo labeled as two different types: we can't know which is right, so drop both.
      conflicts.push(`${path.relative(input, match.file)}  <->  ${path.relative(input, file)}`);
      kept.splice(kept.indexOf(match), 1);
      skipped.conflict += 2;
    }
  }

  const byType = new Map<string, Photo[]>();
  for (const p of kept) byType.set(p.type, [...(byType.get(p.type) ?? []), p]);

  console.log(`\n${"Type".padEnd(20)} ${"Train".padStart(6)} ${"Bench".padStart(6)}`);
  const plan: { photo: Photo; split: "train" | "bench" }[] = [];
  for (const type of INCIDENT_TYPES) {
    const photos = (byType.get(type) ?? []).sort((a, b) => stableKey(a.file).localeCompare(stableKey(b.file)));
    // Never hold out so many that training is left with almost nothing.
    const bench = Math.min(holdout, Math.floor(photos.length / 5));
    photos.forEach((photo, i) => plan.push({ photo, split: i < bench ? "bench" : "train" }));
    const train = photos.length - bench;
    const note = photos.length === 0 ? "  <- no photos" : train < TARGET_PER_TYPE ? `  <- need ${TARGET_PER_TYPE - train} more` : "";
    console.log(`${type.padEnd(20)} ${String(train).padStart(6)} ${String(bench).padStart(6)}${note}`);
  }
  const trainTotal = plan.filter((p) => p.split === "train").length;
  console.log(`${"Total".padEnd(20)} ${String(trainTotal).padStart(6)} ${String(plan.length - trainTotal).padStart(6)}`);
  console.log(`\nSkipped: ${skipped.duplicate} duplicates, ${skipped.conflict} in type conflicts, ${skipped.tooSmall} too small, ${skipped.unreadable} unreadable, ${skipped.inBenchmark} already in benchmark`);
  if (conflicts.length) console.log(`\nSame photo filed under two types (fix the labels, then re-run):\n  ${conflicts.join("\n  ")}`);

  if (args["dry-run"]) {
    console.log("\nDry run: nothing written.");
    return;
  }

  // Don't wipe severities someone already filled in by hand.
  const labelsPath = path.join(benchDir, "labels.csv");
  if (holdout > 0 && !args.force && (await stat(labelsPath).catch(() => null))) {
    throw new Error(
      "benchmark/dataset/labels.csv already exists and may have severities you filled in.\n" +
      "  Re-run with --holdout 0 to only rebuild the training set, or --force to replace the benchmark set.",
    );
  }

  // Rebuild outputs from scratch so removed photos don't linger.
  await rm(out, { recursive: true, force: true });
  if (holdout > 0) {
    for (const type of INCIDENT_TYPES) await rm(path.join(benchDir, type), { recursive: true, force: true });
  }

  const labels = ["file,description,incidentType,severity,bucket"];
  const used = new Set<string>();
  for (const { photo, split } of plan) {
    const base = path.basename(photo.file, path.extname(photo.file)).replace(/[^\w-]+/g, "_").slice(0, 60);
    let name = `${base}.jpg`;
    for (let n = 2; used.has(`${photo.type}/${name}`); n++) name = `${base}-${n}.jpg`;
    used.add(`${photo.type}/${name}`);

    const dest = path.join(split === "train" ? out : benchDir, photo.type, name);
    await mkdir(path.dirname(dest), { recursive: true });
    await sharp(photo.file, { failOn: "none" })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(dest);
    // Severity is left blank on purpose: a person must judge it from the photo.
    if (split === "bench") labels.push(`${photo.type}/${name},,${photo.type},,`);
  }

  if (labels.length > 1) {
    await mkdir(benchDir, { recursive: true });
    await writeFile(labelsPath, labels.join("\n") + "\n");
  }

  console.log(`\nTraining set: ${path.relative(process.cwd(), out)}`);
  if (labels.length > 1) {
    console.log(`Benchmark set: benchmark/dataset (${labels.length - 1} photos)`);
    console.log("  Next: open benchmark/dataset/labels.csv, fill in severity (and a description if you like),");
    console.log("  then check it with: npm run benchmark -- --dry-run");
  }
  console.log(`\nFor Colab, zip the "${path.basename(out)}" folder itself (so the zip contains ${path.basename(out)}/<type>/...)`);
  console.log("and upload it to Google Drive as MyDrive/sagip/dataset.zip.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
