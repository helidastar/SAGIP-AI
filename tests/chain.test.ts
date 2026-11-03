/**
 * Tests for the AI provider chain (src/lib/ai/chain.ts), the cost tracker and severity %:
 *   - fallback provider when the primary fails, retry on transient errors, keyword last
 *   - local primary: low-confidence escalation and AI_LOCAL_ESCALATE_TYPES (ISS-015)
 *   - daily budget cap (AI_DAILY_BUDGET_USD) with a fake Supabase client
 *   - estimateCost prices for Gemini 3.x (ISS-007), severityConfidence normalization (AI 22)
 * ISS-022 – fake providers and database, no network calls.
 * Not covered here: stuck-report recovery, which needs a live database.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyWithFallback, isOverDailyBudget, type ChainProviders } from "@/lib/ai/chain";
import { estimateCost, normalizeClassification } from "@/lib/ai/normalize";
import type { Classifier, ClassifierResult } from "@/lib/ai/types";

const input = { description: "sunog sa bahay, may usok" };

function result(over: Partial<ClassifierResult> = {}): ClassifierResult {
  return {
    incidentType: "fire",
    severity: "high",
    confidence: 0.9,
    hazards: [],
    hoaxSuspected: false,
    raw: {},
    latencyMs: 1,
    costUsd: 0,
    ...over,
  };
}

/** Classifier that returns or throws each queued answer in turn, and counts calls. */
function fake(model: string, ...answers: (ClassifierResult | Error)[]): Classifier & { calls: number } {
  const c = {
    model,
    calls: 0,
    async classify() {
      const next = answers[Math.min(c.calls++, answers.length - 1)];
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return c;
}

const transient = () => Object.assign(new Error("503 high demand"), { status: 503 });
const permanent = () => Object.assign(new Error("404 model not found"), { status: 404 });

/** Fake Supabase client: the budget check reads these cost_usd rows. */
function db(costs: number[] = [], error: unknown = null) {
  const query = { select: () => query, gte: () => query, not: async () => ({ data: costs.map((cost_usd) => ({ cost_usd })), error }) };
  return { from: () => query } as unknown as SupabaseClient;
}

const providers = (p: Partial<ChainProviders>): ChainProviders => ({
  primary: null,
  fallback: null,
  escalateLowConfidence: false,
  escalateTypes: [],
  ...p,
});

afterEach(() => {
  delete process.env.AI_DAILY_BUDGET_USD;
});

describe("classifyWithFallback: fallback chain", () => {
  it("uses the primary when it answers", async () => {
    const primary = fake("gemini-3.6-flash", result());
    const fallback = fake("gemini-3.1-flash-lite", result());
    const out = await classifyWithFallback(db(), input, providers({ primary, fallback }));
    assert.equal(out.step, "primary");
    assert.equal(out.label, "primary:gemini-3.6-flash");
    assert.equal(fallback.calls, 0);
  });

  it("retries the primary once on a transient error", async () => {
    const primary = fake("gemini-3.6-flash", transient(), result());
    const out = await classifyWithFallback(db(), input, providers({ primary }));
    assert.equal(out.step, "primary_retry");
    assert.equal(primary.calls, 2);
  });

  it("goes to the fallback without a retry on a permanent error", async () => {
    const primary = fake("gemini-3.6-flash", permanent());
    const fallback = fake("gemini-3.1-flash-lite", result({ incidentType: "flood" }));
    const out = await classifyWithFallback(db(), input, providers({ primary, fallback }));
    assert.equal(primary.calls, 1);
    assert.equal(out.step, "fallback");
    assert.equal(out.label, "fallback:gemini-3.1-flash-lite");
    assert.equal(out.result.incidentType, "flood");
  });

  it("ends at the keyword matcher (confidence 0) when every provider fails", async () => {
    const primary = fake("gemini-3.6-flash", transient());
    const fallback = fake("gemini-3.1-flash-lite", permanent());
    const out = await classifyWithFallback(db(), input, providers({ primary, fallback }));
    assert.equal(out.step, "keyword");
    assert.equal(out.result.incidentType, "fire");
    assert.equal(out.result.confidence, 0);
    assert.deepEqual(out.attempts.map((a) => a.step), ["primary", "primary_retry", "fallback", "keyword"]);
  });

  it("uses the keyword matcher when no provider is configured", async () => {
    const out = await classifyWithFallback(db(), input, providers({}));
    assert.equal(out.step, "keyword");
    assert.equal(out.skippedProviders, "not_configured");
  });
});

describe("classifyWithFallback: local primary escalation", () => {
  it("keeps a confident local answer", async () => {
    const primary = fake("local:sagip-classifier", result({ confidence: 0.95 }));
    const fallback = fake("gemini-3.1-flash-lite", result());
    const out = await classifyWithFallback(db(), input, providers({ primary, fallback, escalateLowConfidence: true }));
    assert.equal(out.step, "primary");
    assert.equal(fallback.calls, 0);
  });

  it("escalates an unsure local answer to the fallback", async () => {
    const primary = fake("local:sagip-classifier", result({ confidence: 0.5 }));
    const fallback = fake("gemini-3.1-flash-lite", result({ incidentType: "flood" }));
    const out = await classifyWithFallback(db(), input, providers({ primary, fallback, escalateLowConfidence: true }));
    assert.equal(out.step, "escalation");
    assert.equal(out.result.incidentType, "flood");
  });

  it("keeps the unsure local answer when the escalation fails", async () => {
    const primary = fake("local:sagip-classifier", result({ confidence: 0.5 }));
    const fallback = fake("gemini-3.1-flash-lite", permanent());
    const out = await classifyWithFallback(db(), input, providers({ primary, fallback, escalateLowConfidence: true }));
    assert.equal(out.label, "primary:local:sagip-classifier");
    assert.equal(out.result.confidence, 0.5);
  });

  it("escalates a confident answer of a type in escalateTypes (ISS-015)", async () => {
    const primary = fake("local:sagip-classifier", result({ incidentType: "medical_emergency", confidence: 0.97 }));
    const fallback = fake("gemini-3.1-flash-lite", result({ incidentType: "road_accident" }));
    const out = await classifyWithFallback(
      db(),
      input,
      providers({ primary, fallback, escalateLowConfidence: true, escalateTypes: ["medical_emergency"] }),
    );
    assert.equal(out.step, "escalation");
    assert.equal(out.result.incidentType, "road_accident");
  });
});

describe("daily budget cap", () => {
  it("is off when AI_DAILY_BUDGET_USD is unset", async () => {
    assert.equal(await isOverDailyBudget(db([100])), false);
  });

  it("is over once today's spend reaches the budget", async () => {
    process.env.AI_DAILY_BUDGET_USD = "0.05";
    assert.equal(await isOverDailyBudget(db([0.02, 0.02])), false);
    assert.equal(await isOverDailyBudget(db([0.02, 0.03])), true);
  });

  it("allows AI calls when the budget query fails", async () => {
    process.env.AI_DAILY_BUDGET_USD = "0.05";
    assert.equal(await isOverDailyBudget(db([], { message: "db down" })), false);
  });

  it("skips paid providers when over budget and uses the keyword matcher", async () => {
    process.env.AI_DAILY_BUDGET_USD = "0.01";
    const primary = fake("gemini-3.6-flash", result());
    const out = await classifyWithFallback(db([0.02]), input, providers({ primary }));
    assert.equal(primary.calls, 0);
    assert.equal(out.step, "keyword");
    assert.equal(out.skippedProviders, "over_budget");
  });

  it("still runs a local primary when over budget, without escalating", async () => {
    process.env.AI_DAILY_BUDGET_USD = "0.01";
    const primary = fake("local:sagip-classifier", result({ confidence: 0.5 }));
    const fallback = fake("gemini-3.1-flash-lite", result());
    const out = await classifyWithFallback(db([0.02]), input, providers({ primary, fallback, escalateLowConfidence: true }));
    assert.equal(out.step, "primary");
    assert.equal(fallback.calls, 0);
    assert.equal(out.skippedProviders, "over_budget");
  });
});

describe("estimateCost (ISS-007)", () => {
  it("prices gemini-3.1-flash-lite at $0.25 in / $1.50 out per 1M tokens", () => {
    assert.equal(estimateCost("gemini-3.1-flash-lite", 1_000_000, 1_000_000), 1.75);
  });

  it("prices gemini-3.6-flash at $0.75 in / $3.75 out per 1M tokens", () => {
    // About 1,300 input and 60 output tokens per photo classification.
    assert.ok(Math.abs(estimateCost("gemini-3.6-flash", 1300, 60)! - 0.001200) < 1e-9);
  });

  it("returns null for an unknown model or missing token counts", () => {
    assert.equal(estimateCost("gemini-9-ultra", 100, 100), null);
    assert.equal(estimateCost("gemini-3.6-flash", undefined, 100), null);
  });
});

describe("severityConfidence (Severity %)", () => {
  const base = { incidentType: "fire", severity: "high", confidence: 0.9, hazards: [], hoaxSuspected: false };

  it("passes a valid value through", () => {
    assert.equal(normalizeClassification({ ...base, severityConfidence: 0.82 }).severityConfidence, 0.82);
  });

  it("is clamped to [0,1]", () => {
    assert.equal(normalizeClassification({ ...base, severityConfidence: 3 }).severityConfidence, 1);
    assert.equal(normalizeClassification({ ...base, severityConfidence: -0.2 }).severityConfidence, 0);
  });

  it("is null when missing or not a number", () => {
    assert.equal(normalizeClassification(base).severityConfidence, null);
    assert.equal(normalizeClassification({ ...base, severityConfidence: "high" }).severityConfidence, null);
  });
});
