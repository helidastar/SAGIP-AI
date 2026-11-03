// Pull the local classifier's model files into models/ before a Vercel build.
//
// Why this exists (ISS-032): the 3 files below are large and git-ignored, so they're
// currently shared by hand via Google Drive (see training/README.md). A GitHub-triggered
// Vercel build clones the repo only — it never sees models/ — so next.config.ts's
// outputFileTracingIncludes has nothing to trace and AI_PROVIDER=local silently falls
// back to Gemini/keyword in production.
//
// This script downloads the same 3 files from a private Supabase Storage bucket instead,
// as a "prebuild" step (npm runs it automatically before "build" — see package.json).
//
// One-time setup (not done by this script): create a private bucket (default name
// "models"), upload sagip-classifier.onnx, sagip-classifier.onnx.data and labels.json
// to it (keep the .onnx/.onnx.data pair from the SAME training run — see the mismatch
// warning in training/README.md), and set MODEL_STORAGE_BUCKET on Vercel if the bucket
// name differs from the default.
//
// Safe to run anywhere:
//   - If models/ already has all 3 files (e.g. local dev, synced from Drive), does nothing.
//   - If Supabase isn't configured, or the bucket/files aren't there yet, it warns and
//     exits 0 rather than failing the build — AI_PROVIDER=local then fails over to the
//     fallback provider at runtime (chain.ts already handles a missing/unreadable model).
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const MODELS_DIR = path.join(process.cwd(), "models");
const FILES = ["sagip-classifier.onnx", "sagip-classifier.onnx.data", "labels.json"];
const BUCKET = process.env.MODEL_STORAGE_BUCKET || "models";
const PREFIX = process.env.MODEL_STORAGE_PREFIX || "";

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function allFilesPresent() {
  for (const name of FILES) {
    if (!(await exists(path.join(MODELS_DIR, name)))) return false;
  }
  return true;
}

async function main() {
  if (await allFilesPresent()) {
    console.log("[fetch-models] models/ already has all 3 files, skipping download.");
    return 0;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(
      "[fetch-models] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — " +
        "skipping model download. AI_PROVIDER=local will fail over to the fallback " +
        "provider until the models/ files are present (see training/README.md, or set " +
        "up the Supabase Storage bucket for ISS-032)."
    );
    return 0;
  }

  const db = createClient(url, key);
  await mkdir(MODELS_DIR, { recursive: true });

  let downloaded = 0;
  for (const name of FILES) {
    const storagePath = PREFIX ? `${PREFIX}/${name}` : name;
    const { data, error } = await db.storage.from(BUCKET).download(storagePath);
    if (error || !data) {
      console.warn(
        `[fetch-models] could not download "${storagePath}" from bucket "${BUCKET}": ` +
          `${error?.message ?? "no data returned"}. Skipping — see training/README.md ` +
          "for the manual (Drive) fallback."
      );
      continue;
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    await writeFile(path.join(MODELS_DIR, name), bytes);
    console.log(`[fetch-models] wrote models/${name} (${bytes.length} bytes)`);
    downloaded++;
  }

  if (downloaded < FILES.length) {
    console.warn(
      `[fetch-models] only ${downloaded}/${FILES.length} model files downloaded — ` +
        "the local provider will stay unavailable at runtime until the bucket has all 3."
    );
  }
  return 0;
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((err) => {
    // Never fail the build over this — missing models just means local provider is
    // unavailable, and chain.ts already falls back cleanly for that case.
    console.warn("[fetch-models] unexpected error, continuing without models:", err?.message ?? err);
    process.exit(0);
  });
