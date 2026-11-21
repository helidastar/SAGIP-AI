/** Tests for the analytics summary (Backend 5): range parsing and counting. No DB access. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRange, summarize, MAX_ANALYTICS_DAYS, type AnalyticsRow } from "@/lib/reports/analytics";

describe("parseRange", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  it("defaults to the last 7 days", () => {
    const r = parseRange(null, null, now);
    assert.ok(!("error" in r));
    assert.equal(r.to.toISOString(), now.toISOString());
    assert.equal(r.from.toISOString(), "2026-11-14T12:00:00.000Z");
  });
  it("rejects bad dates, reversed ranges and ranges over the limit", () => {
    assert.ok("error" in parseRange("nope", null, now));
    assert.ok("error" in parseRange("2026-11-21", "2026-11-01", now));
    assert.ok("error" in parseRange("2026-01-01", "2026-11-21", now));
    assert.ok(!("error" in parseRange("2026-08-22T12:00:00Z", "2026-11-21T12:00:00Z", now)), `${MAX_ANALYTICS_DAYS} days is allowed`);
  });
});

describe("summarize", () => {
  const rows: AnalyticsRow[] = [
    { status: "classified", confirmed_type: "flood", confirmed_severity: "high", band: "P2", area_name: "Lahug", created_at: "2026-11-20T01:00:00Z" },
    { status: "pending_review", confirmed_type: null, confirmed_severity: null, band: null, area_name: null, created_at: "2026-11-20T17:00:00Z" },
    { status: "resolved", confirmed_type: "fire", confirmed_severity: "critical", band: "P1", area_name: "Lahug", created_at: "2026-11-21T02:00:00Z" },
  ];
  const s = summarize(rows, new Date("2026-11-19T16:00:00Z"), new Date("2026-11-21T12:00:00Z"));

  it("counts every row once in each breakdown", () => {
    assert.equal(s.total, 3);
    for (const part of [s.byType, s.bySeverity, s.byStatus, s.byBand]) {
      assert.equal(Object.values(part).reduce((a, b) => a + b, 0), 3);
    }
    assert.equal(s.byType.flood, 1);
    assert.equal(s.byType.unclassified, 1);
    assert.equal(s.bySeverity.unconfirmed, 1);
    assert.equal(s.byBand.unscored, 1);
    assert.equal(s.byStatus.pending_review, 1);
  });
  it("lists all 8 types, 4 severities, 7 statuses and 4 bands even when zero", () => {
    assert.equal(Object.keys(s.byType).length, 9);
    assert.equal(Object.keys(s.bySeverity).length, 5);
    assert.equal(Object.keys(s.byStatus).length, 7);
    assert.equal(Object.keys(s.byBand).length, 5);
  });
  it("ranks areas by count and names unmapped reports", () => {
    assert.deepEqual(s.byArea, [{ area: "Lahug", count: 2 }, { area: "Outside mapped areas", count: 1 }]);
  });
  it("buckets days in Philippine time, including empty days", () => {
    // 2026-11-20T17:00Z is 2026-11-21 01:00 in Manila.
    assert.deepEqual(s.byDay, [
      { date: "2026-11-20", count: 1 },
      { date: "2026-11-21", count: 2 },
    ]);
  });
});
