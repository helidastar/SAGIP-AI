import type { Severity } from "@/types";

/**
 * Turns the local model's severity output into a severity and a confidence (ISS-016,
 * docs/local-severity-design.md). Pure function so it can be tested without the model.
 *
 * - temperature: divides the raw scores before softmax. The notebook fits it on the
 *   validation photos so that "80% sure" is right about 80% of the time (calibration).
 * - urgentCutoff: if P(high) + P(critical) reaches it, the answer is high or critical
 *   (whichever is more likely), even when moderate is the single top tier. A missed
 *   urgent report costs more than an extra review, so the model leans toward urgent.
 *   The notebook picks the cutoff on the validation photos.
 */
export interface SeverityCalibration {
  temperature?: number;
  urgentCutoff?: number;
}

export function pickSeverity(
  scores: ArrayLike<number>,
  classes: readonly string[],
  { temperature = 1, urgentCutoff }: SeverityCalibration = {},
): { severity: Severity; severityConfidence: number; probabilities: Record<string, number> } {
  const t = temperature > 0 ? temperature : 1;
  const scaled = Array.from(scores, (x) => x / t);
  const max = Math.max(...scaled);
  const exps = scaled.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sum);

  let top = probs.indexOf(Math.max(...probs));
  const high = classes.indexOf("high");
  const critical = classes.indexOf("critical");
  if (urgentCutoff != null && high >= 0 && critical >= 0 && probs[high] + probs[critical] >= urgentCutoff) {
    top = probs[critical] > probs[high] ? critical : high;
  }

  return {
    severity: classes[top] as Severity,
    severityConfidence: probs[top],
    probabilities: Object.fromEntries(classes.map((c, i) => [c, Number(probs[i].toFixed(4))])),
  };
}
