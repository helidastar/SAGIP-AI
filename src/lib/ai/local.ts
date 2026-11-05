import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { INCIDENT_TYPES, SEVERITY } from "@/lib/constants";
import type { IncidentType, Severity } from "@/types";
import { hazardsFromText, severityFromText } from "./keyword";
import type { Classifier } from "./types";

/**
 * Our own image classifier, trained with training/sagip_classifier_colab.ipynb and
 * exported to ONNX. Runs on the server CPU: no API, no quota, no cost.
 *
 * Today's model only predicts the incident type from the photo. Severity and hazards come
 * from the description keywords, so high/critical still depends on the citizen's words.
 * A model exported with a second "severity" output (ISS-016, docs/local-severity-design.md)
 * also gives the severity and its confidence; hazards still come from keywords.
 */
const DEFAULT_MODEL_PATH = "models/sagip-classifier.onnx";

interface Labels {
  classes: string[];
  image_size: number;
  mean: number[];
  std: number[];
  /** Order of the severity output, only in models trained with a severity head. */
  severity_classes?: string[];
}

/** Matches the notebook's eval transform: resize shorter side to size*256/224, center-crop, normalize. */
async function preprocess(image: Buffer, { image_size: size, mean, std }: Labels) {
  const resizeTo = Math.round((size * 256) / 224);
  const resized = await sharp(image, { failOn: "none" })
    .rotate()
    .resize(resizeTo, resizeTo, { fit: "outside" })
    .toBuffer({ resolveWithObject: true });
  const { data } = await sharp(resized.data)
    .extract({
      left: Math.floor((resized.info.width - size) / 2),
      top: Math.floor((resized.info.height - size) / 2),
      width: size,
      height: size,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // HWC uint8 -> CHW float32
  const pixels = size * size;
  const tensor = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) tensor[c * pixels + i] = (data[i * 3 + c] / 255 - mean[c]) / std[c];
  }
  return new ort.Tensor("float32", tensor, [1, 3, size, size]);
}

function softmax(logits: Float32Array) {
  const max = Math.max(...logits);
  const exps = Array.from(logits, (x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function createLocalClassifier(modelPath = DEFAULT_MODEL_PATH): Classifier {
  const resolved = path.resolve(modelPath);
  const labelsPath = path.join(path.dirname(resolved), "labels.json");
  // Load once and reuse; a failed load is retried on the next request.
  let loading: Promise<{ session: ort.InferenceSession; labels: Labels }> | null = null;
  const load = () =>
    (loading ??= (async () => {
      const labels: Labels = JSON.parse(await readFile(labelsPath, "utf8"));
      const unknown = labels.classes.filter((c) => !(INCIDENT_TYPES as readonly string[]).includes(c));
      if (unknown.length) throw new Error(`labels.json has classes the app doesn't know: ${unknown.join(", ")}`);
      const badSeverity = (labels.severity_classes ?? []).filter((c) => !(c in SEVERITY));
      if (badSeverity.length) throw new Error(`labels.json has severities the app doesn't know: ${badSeverity.join(", ")}`);
      return { session: await ort.InferenceSession.create(resolved), labels };
    })().catch((err) => {
      loading = null;
      throw err;
    }));

  return {
    model: `local:${path.basename(resolved, ".onnx")}`,
    async classify({ image, description }, options) {
      const started = Date.now();
      // The model only sees photos. Without one, fail so the chain moves on to the next step.
      if (!image) throw new Error("Local classifier needs a photo");
      options?.signal?.throwIfAborted();

      const { session, labels } = await load();
      const input = await preprocess(image.data, labels);
      const output = await session.run({ [session.inputNames[0]]: input });
      const probs = softmax(output[session.outputNames[0]].data as Float32Array);

      const best = probs.indexOf(Math.max(...probs));
      const incidentType = labels.classes[best] as IncidentType;

      // Severity head if the model has one, else the description keywords.
      let severity: Severity;
      let severityConfidence: number | null = null;
      let from: "model" | "keyword" | "type_default";
      const severityOutput = output.severity;
      if (severityOutput && labels.severity_classes?.length) {
        const sevProbs = softmax(severityOutput.data as Float32Array);
        const top = sevProbs.indexOf(Math.max(...sevProbs));
        severity = labels.severity_classes[top] as Severity;
        severityConfidence = sevProbs[top];
        from = "model";
      } else {
        ({ severity, from } = severityFromText(description, incidentType));
      }

      return {
        incidentType,
        severity,
        confidence: probs[best],
        severityConfidence,
        hazards: hazardsFromText(description),
        // The image model only predicts a type; it has no notion of hoax intent.
        hoaxSuspected: false,
        raw: { probabilities: Object.fromEntries(labels.classes.map((c, i) => [c, Number(probs[i].toFixed(4))])), severityFrom: from },
        latencyMs: Date.now() - started,
        costUsd: 0,
      };
    },
  };
}
