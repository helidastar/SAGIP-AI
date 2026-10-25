# Priority Score Weights

Design record for the priority formula in `src/lib/scoring/index.ts` and the weights in `src/lib/constants.ts`.
Finalized 2026-10-25, after the primary AI model was selected (local model, Gemini as fallback).

**Related:** formula and bands → [DOCUMENTATION.md 6.6–6.7](DOCUMENTATION.md#66-priority-score) · review triggers → [DOCUMENTATION.md 6.5](DOCUMENTATION.md#65-human-review-triggers) · tracker refs: Backend 4, ISS-021, R-014

---

## 1. Formula

```
priority = 100 × ( 0.45 × severity_norm
                 + 0.25 × population_norm
                 + 0.15 × location_risk_norm
                 + 0.15 × type_weight )
```

| Term | Input | Normalized as | Max points |
|---|---|---|---|
| Severity | Confirmed severity tier (AI or reviewer) | low 0.25 · moderate 0.50 · high 0.75 · critical 1.00 | 45 |
| Affected population | `areas.population` of the report's area | ÷ population of the largest area | 25 |
| Location risk | `areas.risk_index` (0–1) | as stored | 15 |
| Incident type | `TYPE_WEIGHTS[type]` | as listed in `constants.ts` | 15 |

A report outside every known area gets 0 for population and location risk (`getAreaFactors()` in `src/lib/reports/score.ts`).

Bands are unchanged: **P1** 80–100 Immediate · **P2** 60–79 Urgent · **P3** 40–59 Standard · **P4** 0–39 Low.

## 2. Why each weight

| Weight | Value | Reason |
|---|---|---|
| Severity | **0.45** | The question responders ask first is "how bad is it?". It is the only input that describes the incident itself, and it is the one a human confirms in review. It gets the largest weight, but under half, so area and type can still separate two reports of the same severity. One severity tier is worth 11.25 points, more than the full spread of the type term (15 × (1.0 − 0.4) = 9), so the type of incident never outweighs a tier of severity. |
| Affected population | **0.25** | The same flood is more urgent in a dense barangay than in an empty field. It is the second largest term because the number of people at risk is the main reason to dispatch sooner. It is kept at 0.25, not higher, because the current area data is a sample file (ISS-020). |
| Location risk | **0.15** | Captures known hazard history (flood-prone, landslide-prone areas). It overlaps with population and type, and it also comes from sample data today, so it gets a small weight. |
| Incident type | **0.15** | Some types escalate faster than others at the same severity (a fire spreads, fallen debris usually does not). The type weights already encode this (fire and medical 1.0, structural 0.9, flood and landslide 0.85, road accident 0.8, fallen debris 0.5, other 0.4), so a small multiplier is enough. |

The four weights add up to 1.0, so the score stays on a 0–100 scale and every term on the dashboard reads as "points out of 100".

## 3. Worked examples

| Report | Severity | Pop. | Risk | Type | Score | Band |
|---|---|---|---|---|---|---|
| Critical fire, largest area, highest risk | 45 | 25 | 15 | 15 | **100** | P1 |
| Critical medical, mid-size area (0.5), mid risk (0.5) | 45 | 12.5 | 7.5 | 15 | **80** | P1 |
| High flood, mid-size area, mid risk | 33.75 | 12.5 | 7.5 | 12.75 | **66.5** | P2 |
| Critical fire, outside every known area | 45 | 0 | 0 | 15 | **60** | P2 |
| Moderate road accident, small area (0.2), low risk (0.2) | 22.5 | 5 | 3 | 12 | **42.5** | P3 |
| Low fallen debris, largest area, highest risk | 11.25 | 25 | 15 | 7.5 | **58.75** | P3 |

What these show:
- Within the same area, a report one tier more severe always ranks higher, whatever its type.
- A low-severity report in the densest, riskiest area can still reach P3 but never P2 or P1.
- A critical report with no area data drops to P2. That is the cost of honest zero values for unknown areas, and it is why area data (ISS-020) matters before a real deployment. Staff can still override the rank (`PATCH /api/incidents/{id}/priority`).

## 4. Alternatives we rejected

| Alternative | Why not |
|---|---|
| Rank by severity only | Most reports would tie within the 4 tiers, and the number of people affected would be ignored. |
| Equal weights (0.25 each) | Severity would drop to 25 points, so low fallen debris in the densest, riskiest area (6.25 + 25 + 25 + 12.5 = 68.75, P2) would outrank a critical fire outside every known area (25 + 0 + 0 + 25 = 50, P3). The area inputs are sample data today, so giving them half the score would make the ranking depend mostly on placeholder numbers. |
| Multiply instead of add (severity × population × …) | A report with no area data would score 0, even if it is critical. The per-term breakdown on the dashboard would also no longer add up to the score, which makes it harder to explain. |
| Let the AI produce the priority | Not deterministic and not auditable: the same report could rank differently on two runs, and nobody could say why. The project rule is that the AI only classifies; scoring is plain code (DOCUMENTATION.md 7.6). |

## 5. How AI severity errors affect the score

The severity term is the one the AI can get wrong, and it carries the most weight, so its errors move the score the most:

- **One tier off moves the score by 11.25 points.** That is enough to move a report one band (for example P2 → P3), but not two.
- **Over-rating is caught.** High and critical AI severities always go to human review (trigger 2 in DOCUMENTATION.md 6.5), so a report the AI rates too high is checked before it reaches the top of the list as a confirmed incident.
- **Under-rating is the real risk.** A critical incident rated moderate with confidence of 0.70 or more skips review and loses 22.5 points. The 50-photo benchmark (2026-10-25) found 7 such misses for both the local model and Gemini (ISS-028). The local model takes severity from description keywords, not the photo (ISS-016), so these misses come from the text.
- **Mitigation.** The score always uses the confirmed severity, so a reviewer's correction re-scores the report. ISS-016 and ISS-028 track changes to the review rule so that under-rated urgent reports reach a human. The weights are not the fix for this: lowering the severity weight would make every correct critical report rank lower too.

## 6. When to revisit

Change the weights only with a reason written in the PR (DOCUMENTATION.md 15.3). Existing scores are not recalculated automatically; DOCUMENTATION.md 15.3 mentions `npm run scores:recompute`, but that script does not exist yet. Revisit when:
- real barangay boundaries, population and risk index replace the sample data (ISS-020): population or location risk may then deserve more weight;
- a pilot partner or responders review real rankings and disagree with the order;
- severity starts coming from the photo model (ISS-016), which changes how much the severity term can be trusted.
