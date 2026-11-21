/** Tests for the severity % label shown next to the severity chip (Admin 12, DOCUMENTATION.md 6.4). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { severityWithPercent } from "@/lib/severity-label";

describe("severityWithPercent", () => {
  it("shows the severity confidence as a whole-number percent", () => {
    assert.equal(severityWithPercent("high", 0.82), "High · 82%");
    assert.equal(severityWithPercent("critical", 0.996), "Critical · 100%");
    assert.equal(severityWithPercent("low", 0), "Low · 0%");
  });
  it("shows a dash when there is no severity confidence", () => {
    assert.equal(severityWithPercent("moderate", null), "Moderate · –");
    assert.equal(severityWithPercent("moderate", undefined), "Moderate · –");
    assert.equal(severityWithPercent("moderate", Number.NaN), "Moderate · –");
  });
  it("clamps values outside 0 to 1", () => {
    assert.equal(severityWithPercent("high", 1.4), "High · 100%");
    assert.equal(severityWithPercent("high", -0.2), "High · 0%");
  });
});
