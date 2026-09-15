import "server-only";
import { GoogleGenAI } from "@google/genai";
import { INCIDENT_TYPES, SEVERITY } from "@/lib/constants";
import { CLASSIFY_PROMPT, CLASSIFY_SCHEMA } from "./prompt";
import type { Classifier, ClassifierInput, ClassifierResult } from "./types";

export function createGeminiClassifier(apiKey: string, model = "gemini-2.5-flash"): Classifier {
  const ai = new GoogleGenAI({ apiKey });

  return {
    model,
    async classify({ image, description }: ClassifierInput): Promise<ClassifierResult> {
      const started = Date.now();
      const parts = [
        { text: CLASSIFY_PROMPT },
        ...(image ? [{ inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } }] : []),
        { text: `Citizen description: """${description}"""` },
      ];
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: { responseMimeType: "application/json", responseJsonSchema: CLASSIFY_SCHEMA },
      });
      const raw = JSON.parse(res.text ?? "{}");

      // Validate — never trust model output blindly.
      const incidentType = INCIDENT_TYPES.includes(raw.incidentType) ? raw.incidentType : "other";
      const severity = raw.severity in SEVERITY ? raw.severity : "moderate";
      const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0));
      const hazards = Array.isArray(raw.hazards) ? raw.hazards.map(String).slice(0, 10) : [];

      return { incidentType, severity, confidence, hazards, raw, latencyMs: Date.now() - started };
    },
  };
}
