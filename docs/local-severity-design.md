# Severity from the local model (ISS-016): design

**Status:** design done and app side ready (2026-10-29). Training is not started; retraining is paused.
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
| Review | No change. High or critical still always goes to a person (trigger 2), so a wrong "high" costs a review, never a missed report. |

### Option rejected: a separate severity model
Two models would double the files we must ship to Vercel (the 250 MB limit, R-017) and double
the time per photo. One shared backbone adds only about 22 KB of weights (1,408 features × 4 tiers).

### Option rejected: keep keyword severity and only tune the keywords
It cannot see the photo, so it cannot fix the ISS-028 misses where the words are vague.

## What is still needed (the other half)
1. **Severity labels for training photos.** Today only the 50 benchmark photos have severity labels,
   and they must never be used for training. We need about 150 or more labeled photos per tier.
   Plan: label a sample of the training set with the same 3-labeler method used for the benchmark
   (Severity Labels tab), starting with high and critical photos. This is the slowest part. Open item.
2. **Notebook change** in `training/sagip_classifier_colab.ipynb`: read a `severity.csv`
   (`file,severity`), add the second head and loss, and export both outputs.
3. **Train and benchmark.** Pass marks, measured with `npm run benchmark` on the 50 photos:
   - severity exact match better than keyword severity on the same run, and
   - missed urgent ≤ 3 (now 7), with type accuracy staying ≥ 86%.
   If either mark fails, keep keyword severity and say so in the defense.

## Limits to state in the defense
- Severity from a photo alone is a judgment call: on the benchmark, our 3 labelers gave 3 different answers on 7 of 50 photos.
- Severity % is the model's own estimate and is not calibrated (DOCUMENTATION.md 6.4).
