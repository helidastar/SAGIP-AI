/**
 * Downloads the extra training photos listed in training/extra-photos.tsv
 * (type, source, id, url) into training/raw/<type>/roboflow-<source>/.
 * All sources are Roboflow Universe datasets under CC BY 4.0, none used by the benchmark.
 *
 * Usage: node scripts/fetch-training-photos.mjs
 * Safe to re-run: photos already on disk are skipped.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const list = (await readFile("training/extra-photos.tsv", "utf8"))
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => {
    const [type, source, id, url] = line.split("\t");
    return { type, url, file: path.join("training/raw", type, `roboflow-${source}`, `${id}.jpg`) };
  });

const counts = {};
let failed = 0;
let next = 0;
async function worker() {
  while (next < list.length) {
    const item = list[next++];
    try {
      if (!existsSync(item.file)) {
        const res = await fetch(item.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await mkdir(path.dirname(item.file), { recursive: true });
        await writeFile(item.file, Buffer.from(await res.arrayBuffer()));
      }
      counts[item.type] = (counts[item.type] ?? 0) + 1;
    } catch (err) {
      failed++;
      console.warn(`Skipped ${item.url}: ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log("Photos on disk:", counts, failed ? `(${failed} failed, re-run to retry)` : "");
