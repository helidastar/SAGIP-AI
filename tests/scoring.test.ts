/**
 * Tests for priority scoring: computePriority and toBand.
 * ISS-026 – no external dependencies, pure math.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computePriority, toBand, PRIORITY_BANDS } from "@/lib/scoring/index";

// ---------------------------------------------------------------------------
// Weights as they are defined in src/lib/constants.ts (used to document intent)
// severity: 0.45 · population: 0.25 · locationRisk: 0.15 · type: 0.15
// SEVERITY enum: low=1, moderate=2, high=3, critical=4
// TYPE_WEIGHTS: fire=1.0, other=0.4
// round1 = Math.round(n * 10) / 10
// ---------------------------------------------------------------------------

describe("computePriority", () => {
  it("maximum score: critical fire with pop=1 and locationRisk=1 → 100", () => {
    const r = computePriority({ severity: "critical", incidentType: "fire", populationNorm: 1, locationRiskNorm: 1 });
    // severity:  round1(100 * 0.45 * (4/4)) = 45
    // population: round1(100 * 0.25 * 1)    = 25
    // locationRisk: round1(100 * 0.15 * 1)  = 15
    // type: round1(100 * 0.15 * 1.0)        = 15
    assert.equal(r.score, 100);
    assert.equal(r.band.band, "P1");
    assert.deepEqual(r.breakdown, { severity: 45, population: 25, locationRisk: 15, type: 15 });
  });

  it("minimum score: low other with pop=0 and locationRisk=0", () => {
    const r = computePriority({ severity: "low", incidentType: "other", populationNorm: 0, locationRiskNorm: 0 });
    // severity:  round1(100 * 0.45 * (1/4)) = round1(11.25) = 11.3
    // population: 0 · type: round1(100 * 0.15 * 0.4) = round1(6) = 6
    assert.equal(r.breakdown.population, 0);
    assert.equal(r.breakdown.locationRisk, 0);
    // Verify breakdown terms sum to score (within floating-point rounding)
    const sum = +(r.breakdown.severity + r.breakdown.population + r.breakdown.locationRisk + r.breakdown.type).toFixed(1);
    assert.equal(r.score, sum);
  });

  it("exact weighted math for moderate flood, pop=0.5, locationRisk=0.5", () => {
    // severity: round1(100 * 0.45 * (2/4)) = round1(22.5) = 22.5
    // population: round1(100 * 0.25 * 0.5) = round1(12.5) = 12.5
    // locationRisk: round1(100 * 0.15 * 0.5) = 7.5
    // type: round1(100 * 0.15 * 0.85) = round1(12.75) = 12.8
    // score = round1(22.5 + 12.5 + 7.5 + 12.8) = round1(55.3) = 55.3
    const r = computePriority({ severity: "moderate", incidentType: "flood", populationNorm: 0.5, locationRiskNorm: 0.5 });
    assert.equal(r.breakdown.severity, 22.5);
    assert.equal(r.breakdown.population, 12.5);
    assert.equal(r.breakdown.locationRisk, 7.5);
    assert.equal(r.breakdown.type, 12.8);
    assert.equal(r.score, 55.3);
  });

  it("exact weighted math for high medical_emergency, pop=0.8, locationRisk=0.3", () => {
    // severity: round1(100 * 0.45 * (3/4)) = round1(33.75) = 33.8
    // population: round1(100 * 0.25 * 0.8) = 20
    // locationRisk: round1(100 * 0.15 * 0.3) = round1(4.5) = 4.5
    // type: round1(100 * 0.15 * 1.0) = 15
    // score = round1(33.8 + 20 + 4.5 + 15) = round1(73.3) = 73.3
    const r = computePriority({ severity: "high", incidentType: "medical_emergency", populationNorm: 0.8, locationRiskNorm: 0.3 });
    assert.equal(r.breakdown.severity, 33.8);
    assert.equal(r.breakdown.population, 20);
    assert.equal(r.breakdown.locationRisk, 4.5);
    assert.equal(r.breakdown.type, 15);
    assert.equal(r.score, 73.3);
    assert.equal(r.band.band, "P2");
  });

  it("clamps populationNorm < 0 to 0", () => {
    const clamped = computePriority({ severity: "low", incidentType: "other", populationNorm: -999, locationRiskNorm: 0 });
    const normal = computePriority({ severity: "low", incidentType: "other", populationNorm: 0, locationRiskNorm: 0 });
    assert.equal(clamped.breakdown.population, 0);
    assert.equal(clamped.score, normal.score);
  });

  it("clamps populationNorm > 1 to 1", () => {
    const clamped = computePriority({ severity: "low", incidentType: "other", populationNorm: 999, locationRiskNorm: 0 });
    const normal = computePriority({ severity: "low", incidentType: "other", populationNorm: 1, locationRiskNorm: 0 });
    assert.equal(clamped.breakdown.population, normal.breakdown.population);
    assert.equal(clamped.score, normal.score);
  });

  it("clamps locationRiskNorm < 0 to 0", () => {
    const clamped = computePriority({ severity: "moderate", incidentType: "flood", populationNorm: 0, locationRiskNorm: -5 });
    const normal = computePriority({ severity: "moderate", incidentType: "flood", populationNorm: 0, locationRiskNorm: 0 });
    assert.equal(clamped.breakdown.locationRisk, 0);
    assert.equal(clamped.score, normal.score);
  });

  it("clamps locationRiskNorm > 1 to 1", () => {
    const clamped = computePriority({ severity: "critical", incidentType: "fire", populationNorm: 1, locationRiskNorm: 5 });
    const normal = computePriority({ severity: "critical", incidentType: "fire", populationNorm: 1, locationRiskNorm: 1 });
    assert.equal(clamped.breakdown.locationRisk, normal.breakdown.locationRisk);
    assert.equal(clamped.score, normal.score);
  });

  it("breakdown terms always sum to score (spot-check several inputs)", () => {
    const cases: Parameters<typeof computePriority>[0][] = [
      { severity: "low", incidentType: "fallen_debris", populationNorm: 0.1, locationRiskNorm: 0.2 },
      { severity: "moderate", incidentType: "road_accident", populationNorm: 0.6, locationRiskNorm: 0.4 },
      { severity: "high", incidentType: "landslide", populationNorm: 0.9, locationRiskNorm: 0.7 },
      { severity: "critical", incidentType: "structural_damage", populationNorm: 0.5, locationRiskNorm: 0.5 },
    ];
    for (const input of cases) {
      const r = computePriority(input);
      const sum = +(r.breakdown.severity + r.breakdown.population + r.breakdown.locationRisk + r.breakdown.type).toFixed(1);
      assert.equal(r.score, sum, `score mismatch for ${JSON.stringify(input)}: score=${r.score} sum=${sum}`);
    }
  });

  it("returns correct PriorityBand object shape", () => {
    const r = computePriority({ severity: "critical", incidentType: "fire", populationNorm: 1, locationRiskNorm: 1 });
    assert.ok(typeof r.band.band === "string");
    assert.ok(typeof r.band.min === "number");
    assert.ok(typeof r.band.label === "string");
  });
});

describe("toBand", () => {
  it("80 → P1 (boundary, inclusive)", () => {
    assert.equal(toBand(80).band, "P1");
  });
  it("79.9 → P2 (just below P1)", () => {
    assert.equal(toBand(79.9).band, "P2");
  });
  it("60 → P2 (boundary, inclusive)", () => {
    assert.equal(toBand(60).band, "P2");
  });
  it("59.9 → P3 (just below P2)", () => {
    assert.equal(toBand(59.9).band, "P3");
  });
  it("40 → P3 (boundary, inclusive)", () => {
    assert.equal(toBand(40).band, "P3");
  });
  it("39.9 → P4 (just below P3)", () => {
    assert.equal(toBand(39.9).band, "P4");
  });
  it("0 → P4 (minimum possible score)", () => {
    assert.equal(toBand(0).band, "P4");
  });
  it("100 → P1 (maximum possible score)", () => {
    assert.equal(toBand(100).band, "P1");
  });
  it("mid-band 70 → P2", () => {
    assert.equal(toBand(70).band, "P2");
  });
  it("mid-band 50 → P3", () => {
    assert.equal(toBand(50).band, "P3");
  });
  it("mid-band 20 → P4", () => {
    assert.equal(toBand(20).band, "P4");
  });
  it("PRIORITY_BANDS is ordered highest min first", () => {
    // toBand relies on find() so the array must be descending
    for (let i = 1; i < PRIORITY_BANDS.length; i++) {
      assert.ok(PRIORITY_BANDS[i - 1].min > PRIORITY_BANDS[i].min,
        `PRIORITY_BANDS[${i - 1}].min (${PRIORITY_BANDS[i - 1].min}) should be > PRIORITY_BANDS[${i}].min (${PRIORITY_BANDS[i].min})`);
    }
  });
});

