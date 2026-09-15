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
Set `GEMINI_API_KEY` and/or `ANTHROPIC_API_KEY` in `.env.local`, then:
```bash
npm run benchmark -- --models gemini:gemini-2.5-flash,claude:claude-haiku-4-5 --yes
```
Use `--limit 5` for a cheap smoke test first.

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
