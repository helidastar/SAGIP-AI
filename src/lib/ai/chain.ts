import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { describeError, isTransientError } from "./errors";
import { classifyWithTimeout, createProvider } from "./index";
import { keywordClassifier } from "./keyword";
import type { Classifier, ClassifierInput, ClassifierResult } from "./types";

const RETRY_DELAY_MS = 1000;

export type ChainStep = "primary" | "primary_retry" | "escalation" | "fallback" | "keyword";

export interface ChainAttempt {
  step: ChainStep;
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: ReturnType<typeof describeError> & { transient: boolean };
}

export interface ChainOutcome {
  result: ClassifierResult;
  step: ChainStep;
  /** Stored in classifications.model, e.g. "primary:gemini-3.6-flash", "escalation:gemini-3.5-flash", "keyword-fallback". */
  label: string;
  attempts: ChainAttempt[];
  skippedProviders?: "over_budget" | "not_configured";
}

function providersFromEnv() {
  // The local model runs on our server, so it needs no API key.
  const make = (provider?: string, key?: string, model?: string, baseUrl?: string) =>
    provider && provider !== "mock" && (key || provider === "local")
      ? createProvider(provider, key ?? "", model || undefined, baseUrl || undefined)
      : null;
  const primaryProvider = process.env.AI_PROVIDER ?? "gemini";
  return {
    // Our own model is cheap but weaker, so its unsure answers get a second opinion from the fallback.
    escalateLowConfidence: primaryProvider === "local",
    primary: make(primaryProvider, process.env.AI_API_KEY, process.env.AI_MODEL, process.env.AI_BASE_URL),
    fallback: make(process.env.AI_FALLBACK_PROVIDER, process.env.AI_FALLBACK_API_KEY, process.env.AI_FALLBACK_MODEL, process.env.AI_FALLBACK_BASE_URL),
  };
}

/** Start of today in Philippine time (UTC+8, no DST), as an ISO timestamp. */
function startOfTodayManila() {
  const offsetMs = 8 * 60 * 60 * 1000;
  const manilaNow = new Date(Date.now() + offsetMs);
  manilaNow.setUTCHours(0, 0, 0, 0);
  return new Date(manilaNow.getTime() - offsetMs).toISOString();
}

/** True when today's recorded AI spend has reached AI_DAILY_BUDGET_USD. Unset = no cap. */
export async function isOverDailyBudget(db: SupabaseClient) {
  const budget = Number(process.env.AI_DAILY_BUDGET_USD);
  if (!process.env.AI_DAILY_BUDGET_USD || !Number.isFinite(budget)) return false;

  const { data, error } = await db
    .from("classifications")
    .select("cost_usd")
    .gte("created_at", startOfTodayManila())
    .not("cost_usd", "is", null);
  if (error) {
    console.error("Budget check failed, allowing AI call", error);
    return false;
  }
  const spent = data.reduce((sum, row) => sum + Number(row.cost_usd), 0);
  return spent >= budget;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(classifier: Classifier, step: ChainStep, input: ClassifierInput, attempts: ChainAttempt[]) {
  const started = Date.now();
  try {
    const result = await classifyWithTimeout(classifier, input);
    attempts.push({ step, model: classifier.model, ok: true, latencyMs: Date.now() - started });
    return result;
  } catch (err) {
    const transient = isTransientError(err);
    attempts.push({ step, model: classifier.model, ok: false, latencyMs: Date.now() - started, error: { ...describeError(err), transient } });
    return { failed: true as const, transient };
  }
}

/**
 * primary (retry once on transient errors) → fallback provider → keyword matcher.
 * With the local model as primary, its low-confidence answers are also escalated
 * to the fallback, and it keeps running when over budget since it costs nothing.
 * Never throws: the keyword step always produces a (confidence 0) result.
 */
export async function classifyWithFallback(db: SupabaseClient, input: ClassifierInput): Promise<ChainOutcome> {
  const attempts: ChainAttempt[] = [];
  const { primary, fallback, escalateLowConfidence } = providersFromEnv();

  let skippedProviders: ChainOutcome["skippedProviders"];
  if (!primary && !fallback) skippedProviders = "not_configured";
  else if (await isOverDailyBudget(db)) skippedProviders = "over_budget";
  const canCallPaid = !skippedProviders;

  let unsure: { result: ClassifierResult; step: ChainStep } | undefined;
  if (primary && (canCallPaid || escalateLowConfidence)) {
    let res = await attempt(primary, "primary", input, attempts);
    if ("failed" in res && res.transient) {
      await sleep(RETRY_DELAY_MS);
      res = await attempt(primary, "primary_retry", input, attempts);
    }
    if (!("failed" in res)) {
      const step = attempts.at(-1)!.step;
      const confident = res.confidence >= CONFIDENCE_THRESHOLD;
      if (!escalateLowConfidence || confident || !fallback || !canCallPaid) {
        return { result: res, step, label: `primary:${primary.model}`, attempts, skippedProviders };
      }
      unsure = { result: res, step };
    }
  }

  if (fallback && canCallPaid) {
    const step: ChainStep = unsure ? "escalation" : "fallback";
    const res = await attempt(fallback, step, input, attempts);
    if (!("failed" in res)) return { result: res, step, label: `${step}:${fallback.model}`, attempts };
  }

  // Escalation failed: the local answer is still better than keywords, and its low confidence sends it to review.
  if (unsure && primary) return { ...unsure, label: `primary:${primary.model}`, attempts, skippedProviders };

  const result = await keywordClassifier.classify(input);
  attempts.push({ step: "keyword", model: keywordClassifier.model, ok: true, latencyMs: 0 });
  return { result, step: "keyword", label: keywordClassifier.model, attempts, skippedProviders };
}
