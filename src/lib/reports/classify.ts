import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyWithTimeout, getClassifier, needsReview, type ClassifierResult } from "@/lib/ai";
import { getAreaFactors, scoreReport } from "@/lib/reports/score";
import { PHOTO_BUCKET } from "@/lib/supabase/admin";

export interface ClassifyReportInput {
  id: string;
  description: string;
  areaId: string | null;
  image?: { data: Buffer; mimeType: string };
  photoPath?: string | null;
  /** false = only record the AI run (no scoring), e.g. for human-reviewed reports. Default true. */
  route?: boolean;
}

export interface ClassifyReportOutcome {
  status: "pending_review" | "classified";
  result: ClassifierResult | null;
  model: string;
}

/**
 * Run the AI on a report, store the classification, and either score it or route it to review.
 * Never throws for AI failures — the report falls back to human review instead.
 */
export async function classifyReport(db: SupabaseClient, report: ClassifyReportInput): Promise<ClassifyReportOutcome> {
  const classifier = getClassifier();

  let image = report.image;
  if (!image && report.photoPath) {
    const { data: blob } = await db.storage.from(PHOTO_BUCKET).download(report.photoPath);
    if (blob) image = { data: Buffer.from(await blob.arrayBuffer()), mimeType: blob.type };
  }

  let result: ClassifierResult;
  try {
    result = await classifyWithTimeout(classifier, { image, description: report.description });
  } catch (err) {
    console.error("Classification failed", report.id, err);
    return { status: "pending_review", result: null, model: classifier.model };
  }

  const { error } = await db.from("classifications").insert({
    report_id: report.id,
    model: classifier.model,
    incident_type: result.incidentType,
    severity: result.severity,
    confidence: result.confidence,
    hazards: result.hazards,
    raw_response: result.raw,
    latency_ms: result.latencyMs,
    cost_usd: result.costUsd,
  });
  if (error) console.error("Saving classification failed", report.id, error);

  if (report.route === false || needsReview(result)) return { status: "pending_review", result, model: classifier.model };

  await scoreReport(db, report.id, {
    severity: result.severity,
    incidentType: result.incidentType,
    ...(await getAreaFactors(db, report.areaId)),
  });
  return { status: "classified", result, model: classifier.model };
}
