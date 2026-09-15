import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { needsReview, type ClassifierResult } from "@/lib/ai";
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
  status: "pending_review" | "classified";
  result: ClassifierResult;
  chain: ChainOutcome;
}

/**
 * Run the fallback chain on a report, store the classification (with every attempt),
 * and either score it or route it to review. Human review remains the final safety net.
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
    hazards: result.hazards,
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

  if (report.route === false || needsReview(result)) return { status: "pending_review", result, chain };

  await scoreReport(db, report.id, {
    severity: result.severity,
    incidentType: result.incidentType,
    ...(await getAreaFactors(db, report.areaId)),
  });
  return { status: "classified", result, chain };
}

/** Background step after intake: classify a "received" report and move it to review or classified. */
export async function processReceivedReport(db: SupabaseClient, reportId: string) {
  const { data: report } = await db
    .from("reports")
    .select("id, description, area_id, photo_path, status")
    .eq("id", reportId)
    .maybeSingle();
  if (!report || report.status !== "received") return;

  try {
    const { status, result } = await classifyReport(db, {
      id: report.id,
      description: report.description,
      areaId: report.area_id,
      photoPath: report.photo_path,
    });
    await db.from("reports").update({
      status,
      ...(status === "classified" ? { confirmed_type: result.incidentType, confirmed_severity: result.severity } : {}),
    }).eq("id", report.id).eq("status", "received");
    await db.from("audit_logs").insert({ report_id: report.id, action: "report_classified", after: { status } });
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
