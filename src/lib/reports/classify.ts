import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkFirstReasons, type CheckFirstReason, type ClassifierResult } from "@/lib/ai";
import { classifyWithFallback, type ChainOutcome } from "@/lib/ai/chain";
import { prepareImageForAi } from "@/lib/ai/image";
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
  /** Staff member who triggered this run, if any (for the audit log). */
  actorId?: string;
}

export interface ClassifyReportOutcome {
  /** Always pending_review: every report goes to a person first (review-first, 2026-11-13). */
  status: "pending_review";
  result: ClassifierResult;
  chain: ChainOutcome;
  /** Review triggers that fired: the report is checked first in the queue. */
  checkFirst: CheckFirstReason[];
}

/**
 * Run the fallback chain on a report and store the classification (with every attempt).
 * The AI's answer is a draft: the report always goes to review, and gets a draft priority
 * score from the AI's type and severity so the queue and dashboard stay ranked. Staff
 * confirm or correct it, which rescores it (POST /api/reports/[id]/review).
 */
export async function classifyReport(db: SupabaseClient, report: ClassifyReportInput): Promise<ClassifyReportOutcome> {
  let image = report.image;
  if (!image && report.photoPath) {
    const { data: blob, error } = await db.storage.from(PHOTO_BUCKET).download(report.photoPath);
    if (error) console.error("Photo download failed", report.id, error);
    if (blob) image = { data: Buffer.from(await blob.arrayBuffer()), mimeType: blob.type };
  }
  if (image) image = await prepareImageForAi(image);

  const chain = await classifyWithFallback(db, { image, description: report.description });
  const { result } = chain;

  const { error } = await db.from("classifications").insert({
    report_id: report.id,
    model: chain.label,
    incident_type: result.incidentType,
    severity: result.severity,
    confidence: result.confidence,
    severity_confidence: result.severityConfidence ?? null,
    hazards: result.hazards,
    hoax_suspected: result.hoaxSuspected,
    raw_response: {
      step: chain.step,
      attempts: chain.attempts,
      skippedProviders: chain.skippedProviders ?? null,
      output: result.raw,
    },
    latency_ms: result.latencyMs,
    cost_usd: result.costUsd,
  });
  if (error) console.error("Saving classification failed", report.id, error);

  const usedFallback = chain.step !== "primary" || chain.attempts.some((a) => !a.ok);
  if (usedFallback) {
    await db.from("audit_logs").insert({
      report_id: report.id,
      actor_id: report.actorId ?? null,
      action: "ai_fallback_used",
      after: { step: chain.step, model: chain.label, skippedProviders: chain.skippedProviders ?? null, attempts: chain.attempts },
    });
  }

  const checkFirst = checkFirstReasons(result);
  if (report.route === false) return { status: "pending_review", result, chain, checkFirst };

  // Draft priority from the AI's answer; replaced when staff confirm the type and severity.
  await scoreReport(db, report.id, {
    severity: result.severity,
    incidentType: result.incidentType,
    ...(await getAreaFactors(db, report.areaId)),
  });
  return { status: "pending_review", result, chain, checkFirst };
}

/** Background step after intake: classify a "received" report and move it to review with an AI draft. */
export async function processReceivedReport(db: SupabaseClient, reportId: string) {
  const { data: report } = await db
    .from("reports")
    .select("id, description, area_id, photo_path, status")
    .eq("id", reportId)
    .maybeSingle();
  if (!report || report.status !== "received") return;

  try {
    const { status, checkFirst } = await classifyReport(db, {
      id: report.id,
      description: report.description,
      areaId: report.area_id,
      photoPath: report.photo_path,
    });
    await db.from("reports").update({ status }).eq("id", report.id).eq("status", "received");
    await db.from("audit_logs").insert({ report_id: report.id, action: "report_classified", after: { status, checkFirst } });
  } catch (err) {
    // Unexpected failure (DB, storage): never leave a report stuck — send it to humans.
    console.error("Background classification failed", report.id, err);
    await db.from("reports").update({ status: "pending_review" }).eq("id", report.id).eq("status", "received");
    await db.from("audit_logs").insert({
      report_id: report.id,
      action: "classification_error",
      after: { status: "pending_review", error: err instanceof Error ? err.message.slice(0, 500) : String(err) },
    });
  }
}
