# Severity from the local model (ISS-016): design

**Status:** design done and app side ready (2026-10-29). Calibration and the urgent cutoff added 2026-11-13 (route chosen by rye). Training waits on the severity labels.
**Owner:** Ricabo · **Checklist:** AI Integration 25 · **Related:** ISS-016, ISS-028, [DOCUMENTATION.md 6.4](DOCUMENTATION.md#64-ai-estimated-vs-confirmed-severity)

## The problem
Our image model predicts only the incident type. Severity comes from description keywords
(`severityFromText` in `src/lib/ai/keyword.ts`), or a default per type when no keyword matches.
A citizen who writes "help" under a photo of a burning house gets the fire default, not what the
photo shows. On the 50-photo benchmark (2026-10-25) the local chain missed 7 urgent photos
(high or critical rated low or moderate with confidence ≥ 0.70), and those misses come from
severity, not from the type (ISS-028).

## Design: a second output head
Keep one model and add a second small output layer for the 4 severity tiers, next to the type layer.

| Part | Choice |
|---|---|
| Model | Same backbone (`efficientnet_b2`). Two linear heads on the shared features: `logits` (8 types) and `severity` (4 tiers: low, moderate, high, critical). |
| Loss | `type_loss + 0.5 × severity_loss`, cross-entropy for both. Rows with no severity label are skipped in the severity loss only. |
| Export | ONNX outputs named `logits` and `severity`. `labels.json` gets `"severity_classes": ["low", "moderate", "high", "critical"]`. |
| App | `src/lib/ai/local.ts` already reads the `severity` output when it is there (done 2026-10-29). It takes the top tier as severity and its probability as `severityConfidence` (Severity %). A model without the head keeps working as today, with keyword severity. |
| Calibration | The notebook fits a `severity_temperature` on the validation photos so that "80% sure" is right about 80% of the time, and saves it in `labels.json`. `src/lib/ai/severity.ts` applies it. |
| Urgent cutoff | If P(high) + P(critical) reaches `severity_urgent_cutoff`, the answer is high or critical, even when moderate is the single top tier. The notebook picks the highest cutoff that still catches 95% (`URGENT_RECALL_TARGET`) of the truly high/critical validation photos. |
| Review | High or critical still always goes to a person (trigger 2), so a wrong "high" costs a review, never a missed report. The urgent cutoff uses that on purpose. |

### Why the urgent cutoff (added 2026-11-13)
The 50-photo benchmark has no descriptions, so today the local severity is only the default per type
(moderate for flood, landslide, structural damage and road accident; low for fallen debris). All 13 missed
urgent of the 2026-11-13 model come from those defaults. The severity labels for training come from Gemini
first, and Gemini alone missed 7 urgent photos on the same benchmark, so a head that only copies Gemini's top
answer would likely miss about as many. Missing an urgent report costs more than one extra review, so the
model answers high whenever high and critical together are likely enough.

Option rejected: raise the type defaults to high. No retraining, but every photo-only flood, landslide,
structural or road report would go to review, and it still does not look at the photo. Kept as the backup if
the pass marks below fail.
Option rejected: a 5th review trigger for photo-only severity guesses. It changes the fixed count of 4.

### Option rejected: a separate severity model
Two models would double the files we must ship to Vercel (the 250 MB limit, R-017) and double
the time per photo. One shared backbone adds only about 22 KB of weights (1,408 features × 4 tiers).

### Option rejected: keep keyword severity and only tune the keywords
It cannot see the photo, so it cannot fix the ISS-028 misses where the words are vague.

## What is still needed (the other half)
1. **Severity labels for training photos.** Today only the 50 benchmark photos have severity labels,
   and they must never be used for training. We need about 150 or more labeled photos per tier.
   Plan (2026-11-13): Gemini drafts them on rye's laptop, then the team checks the high and critical rows:
   ```
   npm run label-severity -- --dataset training/dataset --target-per-tier 150 --yes
   ```
   It waits 4.5 s between calls (under the free tier's 15 requests per minute), so about 1,000 photos take
   about 75 minutes. The daily free-tier limit is not measured: if the quota runs out the script stops and
   resumes on the next run. Output `training/dataset/severity.csv` (`file,severity,confidence,gemini_type`).
   Upload the checked file to `MyDrive/sagip/severity.csv`. Open item: the team check.
2. **Notebook change** in `training/sagip_classifier_colab.ipynb`: done (PR #35, plus calibration and the urgent
   cutoff). It reads `MyDrive/sagip/severity.csv`, weights the severity tiers so rare ones are not ignored,
   calibrates on the validation photos, and exports both outputs.
3. **Train and benchmark.** Pass marks, measured with `npm run benchmark` on the 50 photos:
   - severity exact match better than keyword severity on the same run, and
   - missed urgent ≤ 3 (now 7), with type accuracy staying ≥ 86%.
   If either mark fails, keep keyword severity and say so in the defense.

## Limits to state in the defense
- Severity from a photo alone is a judgment call: on the benchmark, our 3 labelers gave 3 different answers on 7 of 50 photos.
- Severity % from the local head is calibrated against the checked Gemini labels, not against ground truth.
  Gemini's own Severity % is not calibrated (DOCUMENTATION.md 6.4).
- The urgent cutoff trades extra reviews for fewer missed urgent reports. The review rate it causes is in
  `metrics.json` (`severity_calibration.val.review_rate_from_severity`) and in the benchmark.
