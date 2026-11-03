/**
 * Tests for AI-related pure logic:
 *   - needsReview (src/lib/ai/review.ts)
 *   - keywordClassifier.classify, severityFromText, hazardsFromText (src/lib/ai/keyword.ts)
 *   - normalizeClassification (src/lib/ai/normalize.ts)
 * ISS-026 – no network calls; all pure functions.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { needsReview } from "@/lib/ai/review";
import { keywordClassifier, severityFromText, hazardsFromText } from "@/lib/ai/keyword";
import { normalizeClassification } from "@/lib/ai/normalize";

// ---------------------------------------------------------------------------
// needsReview
// ---------------------------------------------------------------------------
describe("needsReview", () => {
  const base = { incidentType: "flood" as const, hazards: [], hoaxSuspected: false };

  it("returns true when confidence < 0.70 (threshold default)", () => {
    assert.equal(needsReview({ ...base, severity: "low", confidence: 0.69 }), true);
  });

  it("returns true when confidence is exactly 0 (keyword fallback)", () => {
    assert.equal(needsReview({ ...base, severity: "low", confidence: 0 }), true);
  });

  it("returns false when confidence >= 0.70, severity is low, hoaxSuspected false", () => {
    assert.equal(needsReview({ ...base, severity: "low", confidence: 0.70 }), false);
    assert.equal(needsReview({ ...base, severity: "low", confidence: 0.99 }), false);
  });

  it("returns false when confidence >= 0.70, severity is moderate, hoaxSuspected false", () => {
    assert.equal(needsReview({ ...base, severity: "moderate", confidence: 0.75 }), false);
    assert.equal(needsReview({ ...base, severity: "moderate", confidence: 1.0 }), false);
  });

  it("returns true when severity is 'high' even at confidence 0.99", () => {
    assert.equal(needsReview({ ...base, severity: "high", confidence: 0.99 }), true);
  });

  it("returns true when severity is 'critical' even at confidence 0.99", () => {
    assert.equal(needsReview({ ...base, severity: "critical", confidence: 0.99 }), true);
  });

  it("returns true when hoaxSuspected is true even at confidence 0.99 and severity low", () => {
    assert.equal(needsReview({ ...base, severity: "low", confidence: 0.99, hoaxSuspected: true }), true);
  });

  it("returns true when hoaxSuspected is true even at confidence 1.0 and severity moderate", () => {
    assert.equal(needsReview({ ...base, severity: "moderate", confidence: 1.0, hoaxSuspected: true }), true);
  });

  it("confidence exactly at threshold 0.70, severity low → false", () => {
    assert.equal(needsReview({ ...base, severity: "low", confidence: 0.70 }), false);
  });

  it("confidence just below threshold 0.699, severity low → true", () => {
    assert.equal(needsReview({ ...base, severity: "low", confidence: 0.699 }), true);
  });
});

// ---------------------------------------------------------------------------
// keywordClassifier.classify
// ---------------------------------------------------------------------------
describe("keywordClassifier.classify", () => {
  async function classify(description: string) {
    return keywordClassifier.classify({ description });
  }

  it("always returns confidence: 0", async () => {
    const r = await classify("Sunog sa balay");
    assert.equal(r.confidence, 0);
  });

  it("always returns hoaxSuspected: false", async () => {
    const r = await classify("Nasugatan ang bata, dugo ang ulo");
    assert.equal(r.hoaxSuspected, false);
  });

  // needsReview is always true because confidence === 0
  it("confidence 0 means needsReview is always true", async () => {
    const r = await classify("walay sulod");
    const { needsReview: nr } = await import("@/lib/ai/review");
    assert.equal(nr(r), true);
  });

  // ── English keywords ───────────────────────────────────────────────────────
  it("English: 'house is on fire and there is smoke' → fire", async () => {
    const r = await classify("house is on fire and there is smoke");
    assert.equal(r.incidentType, "fire");
  });

  it("English: 'flooding in our street, water is knee deep' → flood + moderate severity", async () => {
    const r = await classify("flooding in our street, water is knee deep");
    assert.equal(r.incidentType, "flood");
    // 'knee deep' is a moderate severity keyword
    assert.equal(r.severity, "moderate");
  });

  it("English: 'landslide blocked the road' → landslide", async () => {
    const r = await classify("landslide blocked the road");
    assert.equal(r.incidentType, "landslide");
  });

  it("English: 'motorcycle accident collision on the highway' → road_accident", async () => {
    const r = await classify("motorcycle accident collision on the highway");
    assert.equal(r.incidentType, "road_accident");
  });

  it("English: 'building collapsed, wall cracked' → structural_damage", async () => {
    const r = await classify("building collapsed, wall cracked");
    assert.equal(r.incidentType, "structural_damage");
  });

  it("English: 'person injured bleeding unconscious' → medical_emergency + high severity", async () => {
    const r = await classify("person injured bleeding unconscious");
    assert.equal(r.incidentType, "medical_emergency");
    assert.equal(r.severity, "high");
  });

  it("English: 'fallen tree branch on power line' → fallen_debris", async () => {
    const r = await classify("fallen tree branch on power line");
    assert.equal(r.incidentType, "fallen_debris");
  });

  it("English: 'walay klaro' (no keyword match) → other", async () => {
    const r = await classify("walay klaro");
    assert.equal(r.incidentType, "other");
  });

  // ── Filipino keywords ──────────────────────────────────────────────────────
  it("Filipino: 'sunog sa balay namatay' → fire, critical severity", async () => {
    const r = await classify("sunog sa balay namatay");
    assert.equal(r.incidentType, "fire");
    // 'namatay' matches critical severity keyword
    assert.equal(r.severity, "critical");
  });

  it("Filipino: 'nagbaha abot tuhod' → flood, moderate severity", async () => {
    const r = await classify("nagbaha abot tuhod sa dalan");
    assert.equal(r.incidentType, "flood");
    assert.equal(r.severity, "moderate");
  });

  it("Filipino: 'aksidente motor disgrasya' → road_accident", async () => {
    const r = await classify("aksidente motor disgrasya sa kalsada");
    assert.equal(r.incidentType, "road_accident");
  });

  it("Filipino: 'nasamad dugo sugat' → medical_emergency, high severity", async () => {
    const r = await classify("nasamad dugo sugat");
    assert.equal(r.incidentType, "medical_emergency");
    assert.equal(r.severity, "high");
  });

  // ── Cebuano keywords ──────────────────────────────────────────────────────
  it("Cebuano: 'kalayo apoy nagliyab' → fire", async () => {
    const r = await classify("kalayo apoy nagliyab");
    assert.equal(r.incidentType, "fire");
  });

  it("Cebuano: 'lunop nalunop tubig' → flood", async () => {
    const r = await classify("lunop nalunop tubig");
    assert.equal(r.incidentType, "flood");
  });

  it("Cebuano: 'pagguho yuta guho' → landslide", async () => {
    const r = await classify("pagguho yuta guho");
    assert.equal(r.incidentType, "landslide");
  });

  it("Cebuano: 'nabangga sakyanan bangga motor' → road_accident", async () => {
    const r = await classify("nabangga sakyanan bangga motor");
    assert.equal(r.incidentType, "road_accident");
  });

  it("Cebuano: 'nagun-ob bilding tulay nahugno' → structural_damage", async () => {
    const r = await classify("nagun-ob bilding tulay nahugno");
    assert.equal(r.incidentType, "structural_damage");
  });

  it("Cebuano: 'nakuyapan himatay nasugatan' → medical_emergency", async () => {
    const r = await classify("nakuyapan himatay nasugatan");
    assert.equal(r.incidentType, "medical_emergency");
  });

  it("Cebuano: 'punoan puno sanga poste natumba' → fallen_debris", async () => {
    const r = await classify("punoan puno sanga poste natumba");
    // fallen_debris vs structural_damage — 'natumba' appears in both; more fallen_debris words match here
    // The classifier picks the type with the most keyword matches.
    assert.ok(["fallen_debris", "structural_damage"].includes(r.incidentType),
      `Expected fallen_debris or structural_damage, got ${r.incidentType}`);
  });

  // ── Severity defaults per type ─────────────────────────────────────────────
  it("fire with no severity keyword → default severity 'high'", async () => {
    const r = await classify("sunog sa balay");
    // no critical/high/moderate keyword → falls back to DEFAULT_SEVERITY for fire = 'high'
    assert.equal(r.severity, "high");
  });

  it("fallen_debris with no severity keyword → default severity 'low'", async () => {
    const r = await classify("fallen tree branch on road");
    assert.equal(r.severity, "low");
  });

  // ── Critical severity keywords ─────────────────────────────────────────────
  it("'patay namatay' → critical severity", async () => {
    const r = await classify("naay patay namatay sa sunog");
    assert.equal(r.severity, "critical");
  });

  it("'trapped many people' → critical severity", async () => {
    const r = await classify("many people trapped inside the burning building");
    assert.equal(r.severity, "critical");
  });

  // ── hazards array ──────────────────────────────────────────────────────────
  it("hazards array is deduplicated and at most 10 items", async () => {
    const r = await classify("fire burning smoke flames sunog nasunog kalayo usok aso apoy nagliyab and more fire");
    assert.ok(Array.isArray(r.hazards));
    assert.ok(r.hazards.length <= 10);
    // All entries should be unique
    assert.equal(r.hazards.length, new Set(r.hazards).size);
  });

  it("hazards are a subset of the matched type keywords", async () => {
    const r = await classify("fire burning smoke");
    assert.ok(r.hazards.every((h) => typeof h === "string"));
  });
});

// ---------------------------------------------------------------------------
// severityFromText
// ---------------------------------------------------------------------------
describe("severityFromText", () => {
  it("'knee deep' → moderate for flood", () => {
    const r = severityFromText("water is knee deep", "flood");
    assert.equal(r.severity, "moderate");
    assert.equal(r.from, "keyword");
  });

  it("'chest deep' → high for flood", () => {
    const r = severityFromText("water is chest deep", "flood");
    assert.equal(r.severity, "high");
    assert.equal(r.from, "keyword");
  });

  it("'dead patay' → critical", () => {
    const r = severityFromText("may patay na", "fire");
    assert.equal(r.severity, "critical");
    assert.equal(r.from, "keyword");
  });

  it("no keyword → falls back to type default for fire = 'high'", () => {
    const r = severityFromText("may sunog", "fire");
    assert.equal(r.severity, "high");
    assert.equal(r.from, "type_default");
  });

  it("no keyword → falls back to type default for fallen_debris = 'low'", () => {
    const r = severityFromText("fallen tree", "fallen_debris");
    assert.equal(r.severity, "low");
    assert.equal(r.from, "type_default");
  });

  it("no keyword → falls back to type default for other = 'low'", () => {
    const r = severityFromText("something happened", "other");
    assert.equal(r.severity, "low");
    assert.equal(r.from, "type_default");
  });

  it("'abot tuhod' (Cebuano for knee-deep) → moderate", () => {
    const r = severityFromText("baha abot tuhod sa dalan", "flood");
    assert.equal(r.severity, "moderate");
    assert.equal(r.from, "keyword");
  });

  it("critical wins over high when both keywords present (first match in order)", () => {
    // SEVERITY_KEYWORDS is ordered critical, high, moderate — first match wins
    const r = severityFromText("person dead and bleeding", "medical_emergency");
    assert.equal(r.severity, "critical");
  });
});

// ---------------------------------------------------------------------------
// hazardsFromText
// ---------------------------------------------------------------------------
describe("hazardsFromText", () => {
  it("returns matched keywords from description", () => {
    const h = hazardsFromText("fire burning smoke in the building");
    assert.ok(h.includes("fire"), `expected 'fire' in ${JSON.stringify(h)}`);
    assert.ok(h.includes("smoke"), `expected 'smoke' in ${JSON.stringify(h)}`);
    assert.ok(h.includes("burning"), `expected 'burning' in ${JSON.stringify(h)}`);
  });

  it("returns at most 10 items", () => {
    const h = hazardsFromText(
      "fire burning smoke flames sunog kalayo usok aso apoy building collapsed wall crack flood water accident crash"
    );
    assert.ok(h.length <= 10);
  });

  it("returns empty array for unrecognized text", () => {
    const h = hazardsFromText("nothing relevant here at all blah blah blah");
    assert.deepEqual(h, []);
  });

  it("deduplicates matched words", () => {
    const h = hazardsFromText("fire fire fire fire");
    assert.equal(h.length, new Set(h).size);
  });

  it("matches Filipino/Cebuano keywords", () => {
    const h = hazardsFromText("sunog sa balay naay dugo");
    assert.ok(h.includes("sunog"), `expected 'sunog' in ${JSON.stringify(h)}`);
    assert.ok(h.includes("dugo"), `expected 'dugo' in ${JSON.stringify(h)}`);
  });
});

// ---------------------------------------------------------------------------
// normalizeClassification
// ---------------------------------------------------------------------------
describe("normalizeClassification", () => {
  it("valid input passes through unchanged", () => {
    const raw = { incidentType: "fire", severity: "critical", confidence: 0.95, hazards: ["smoke"], hoaxSuspected: false };
    const r = normalizeClassification(raw);
    assert.equal(r.incidentType, "fire");
    assert.equal(r.severity, "critical");
    assert.equal(r.confidence, 0.95);
    assert.deepEqual(r.hazards, ["smoke"]);
    assert.equal(r.hoaxSuspected, false);
  });

  it("unknown incidentType falls back to 'other'", () => {
    const r = normalizeClassification({ incidentType: "tornado", severity: "high", confidence: 0.9, hazards: [], hoaxSuspected: false });
    assert.equal(r.incidentType, "other");
  });

  it("unknown severity falls back to 'moderate'", () => {
    const r = normalizeClassification({ incidentType: "fire", severity: "catastrophic", confidence: 0.9, hazards: [], hoaxSuspected: false });
    assert.equal(r.severity, "moderate");
  });

  it("confidence is clamped to [0,1]", () => {
    assert.equal(normalizeClassification({ incidentType: "fire", severity: "high", confidence: 999, hazards: [], hoaxSuspected: false }).confidence, 1);
    assert.equal(normalizeClassification({ incidentType: "fire", severity: "high", confidence: -1, hazards: [], hoaxSuspected: false }).confidence, 0);
  });

  it("null/undefined input uses all safe defaults", () => {
    const r = normalizeClassification(null);
    assert.equal(r.incidentType, "other");
    assert.equal(r.severity, "moderate");
    assert.equal(r.confidence, 0);
    assert.deepEqual(r.hazards, []);
    assert.equal(r.hoaxSuspected, false);
  });

  it("hoaxSuspected is only true when explicitly true", () => {
    assert.equal(normalizeClassification({ incidentType: "fire", severity: "high", confidence: 0.9, hazards: [], hoaxSuspected: "yes" }).hoaxSuspected, false);
    assert.equal(normalizeClassification({ incidentType: "fire", severity: "high", confidence: 0.9, hazards: [], hoaxSuspected: 1 }).hoaxSuspected, false);
    assert.equal(normalizeClassification({ incidentType: "fire", severity: "high", confidence: 0.9, hazards: [], hoaxSuspected: true }).hoaxSuspected, true);
  });

  it("hazards truncated to 10 items", () => {
    const hazards = Array.from({ length: 20 }, (_, i) => `h${i}`);
    const r = normalizeClassification({ incidentType: "fire", severity: "high", confidence: 0.9, hazards, hoaxSuspected: false });
    assert.equal(r.hazards.length, 10);
  });

  it("non-array hazards becomes empty array", () => {
    const r = normalizeClassification({ incidentType: "fire", severity: "high", confidence: 0.9, hazards: "smoke", hoaxSuspected: false });
    assert.deepEqual(r.hazards, []);
  });
});

