# AI Classification Benchmark

Compares vision-LLMs on labeled incident photos, following DOCUMENTATION.md Appendix B.

## 1. Build the dataset
Put images in `benchmark/dataset/` and list them in `benchmark/dataset/labels.csv`
(copy `labels.example.csv`). Images and results are git-ignored; share the dataset privately.

| Column | Required | Values |
|---|---|---|
| `file` | yes | Path relative to `benchmark/dataset/`, e.g. `flood/flood-01.jpg` (jpg, png, webp, gif) |
| `description` | no | What a citizen might type. Leave empty to test photo-only |
| `incidentType` | yes | `fire`, `flood`, `landslide`, `road_accident`, `structural_damage`, `medical_emergency`, `fallen_debris`, `other` |
| `severity` | yes | `low`, `moderate`, `high`, `critical` |
| `bucket` | no | Group for per-bucket accuracy, e.g. `ambiguous`, `low_light`. Defaults to `incidentType` |

Aim for 40–60 images, 8–10 per category plus an ambiguous/hard bucket, with mixed quality.
Only use photos you have the right to use, and avoid identifiable faces or plate numbers.

## 2. Validate (free)
```bash
npm run benchmark -- --dry-run
```

## 3. Run (paid API calls)
Set `GEMINI_API_KEY` in `.env.local` (the models we actually run), then:
```bash
npm run benchmark -- --models gemini:gemini-3.1-flash-lite,gemini:gemini-3.5-flash --concurrency 1 --yes
```
Use `--limit 5` for a cheap smoke test first.

**Free tier:** Gemini's free quota resets daily. Run with `--limit 10 --concurrency 1`
once rather than repeatedly, so you don't use up the quota.

**Our own model (free, no quota):** train it with `training/sagip_classifier_colab.ipynb`,
put `sagip-classifier.onnx` and `labels.json` in `models/`, then compare it with Gemini:
```bash
npm run benchmark -- --models local,gemini:gemini-3.1-flash-lite --concurrency 1 --yes
```
`local` alone uses `models/sagip-classifier.onnx`; `local:<path.onnx>` picks another file.
Keep benchmark photos out of the training split, or the local model's score will be inflated.
The local model predicts only the incident type from the photo; severity comes from the
description keywords, so expect it to score lower on severity than Gemini.

Llama runs against any OpenAI-compatible host, but no current host offers Llama vision for
free (Groq dropped it), so it's not part of the free setup. See the AI log (2026-09-21).

## 4. Read the results
Each run writes `benchmark/results/<timestamp>/`:
- `report.md` — ranked summary, accuracy per bucket, confusion matrices
- `summary.json` — the same metrics as data
- `runs.jsonl` — every individual call (for digging into failures)

| Metric | Meaning |
|---|---|
| Score | Appendix B.4 weighted score (0–100). Cost and latency are relative to the best model in the run |
| Type acc. | Correct incident type |
| Severity ±1 | Severity within one tier |
| Brier ↓ | How well confidence matches correctness (0 = perfect) |
| Review rate | Share that would go to human review with the current threshold |
| Missed urgent ↓ | High/critical incidents rated low/moderate **and** skipping review. Should be 0 |

To test a different review threshold, set `CONFIDENCE_THRESHOLD=0.8` before running.
