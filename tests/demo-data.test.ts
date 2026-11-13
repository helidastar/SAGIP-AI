// Checks the simulated Cebu City demo data (scripts/data) without a database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { needsReview } from "@/lib/ai/review";
import { INCIDENT_TYPES, REPORT_STATUSES, SEVERITY } from "@/lib/constants";

const areas = JSON.parse(readFileSync(new URL("../scripts/data/areas.cebu-city.geojson", import.meta.url), "utf8"));
const { reports } = JSON.parse(readFileSync(new URL("../scripts/data/demo-reports.json", import.meta.url), "utf8"));
const TEAMS = ["Fire Response", "Medical Response", "Search and Rescue", "Road Clearing"]; // scripts/seed.mjs

// Cebu City bounding box (rough): the demo must stay inside the city.
const CEBU = { minLng: 123.75, maxLng: 123.95, minLat: 10.25, maxLat: 10.5 };

type Ring = [number, number][];
const ringOf = (name: string): Ring | undefined =>
  areas.features.find((f: { properties: { name: string } }) => f.properties.name === name)?.geometry.coordinates[0];
const inBox = (ring: Ring, lng: number, lat: number) => {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return lng > Math.min(...lngs) && lng < Math.max(...lngs) && lat > Math.min(...lats) && lat < Math.max(...lats);
};

describe("Cebu City areas", () => {
  it("are rectangles inside Cebu City with valid population and risk", () => {
    for (const f of areas.features) {
      const ring: Ring = f.geometry.coordinates[0];
      assert.equal(ring.length, 5, f.properties.name);
      for (const [lng, lat] of ring) {
        assert.ok(lng >= CEBU.minLng && lng <= CEBU.maxLng && lat >= CEBU.minLat && lat <= CEBU.maxLat, f.properties.name);
      }
      assert.ok(f.properties.population > 0, f.properties.name);
      assert.ok(f.properties.riskIndex >= 0 && f.properties.riskIndex <= 1, f.properties.name);
    }
  });

  it("do not overlap (area_for_point would pick one at random)", () => {
    const boxes = areas.features.map((f: { properties: { name: string }; geometry: { coordinates: Ring[] } }) => {
      const ring = f.geometry.coordinates[0];
      return { name: f.properties.name, x0: ring[0][0], y0: ring[0][1], x1: ring[2][0], y1: ring[2][1] };
    });
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        assert.ok(!(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1), `${a.name} overlaps ${b.name}`);
      }
  });
});

describe("Cebu City demo reports", () => {
  it("cover all 8 incident types and all 4 severity levels", () => {
    assert.deepEqual(new Set(reports.map((r: { ai: { incidentType: string } }) => r.ai.incidentType)), new Set(INCIDENT_TYPES));
    assert.deepEqual(new Set(reports.map((r: { ai: { severity: string } }) => r.ai.severity)), new Set(Object.keys(SEVERITY)));
  });

  it("each sit inside their named area", () => {
    for (const r of reports) {
      const ring = ringOf(r.area);
      assert.ok(ring, `${r.code}: unknown area ${r.area}`);
      assert.ok(inBox(ring, r.lng, r.lat), `${r.code} is outside ${r.area}`);
    }
  });

  it("use unique SGP-DEM tracking codes from the tracking-code alphabet", () => {
    const codes = reports.map((r: { code: string }) => r.code);
    assert.equal(new Set(codes).size, codes.length);
    for (const c of codes) assert.match(c, /^SGP-DEM[A-HJ-NP-Z2-9]{3}$/);
  });

  it("follow the review rules: flagged reports are queued or carry a human review", () => {
    for (const r of reports) {
      assert.ok((REPORT_STATUSES as readonly string[]).includes(r.status), r.code);
      if (needsReview(r.ai)) assert.ok(r.status === "pending_review" || r.review, `${r.code} skipped human review`);
      else assert.ok(r.review === null && r.status !== "pending_review", `${r.code} should not need review`);
      if (r.status === "pending_review") assert.equal(r.review, null, r.code);
    }
  });

  it("keyword-fallback and hoax reports wait for a human", () => {
    for (const r of reports.filter((x: { ai: { provider: string; hoaxSuspected: boolean } }) => x.ai.provider === "keyword" || x.ai.hoaxSuspected)) {
      assert.equal(r.status, "pending_review", r.code);
    }
  });

  it("assign a known team exactly when the status needs one", () => {
    for (const r of reports) {
      const needsTeam = ["assigned", "in_progress", "resolved"].includes(r.status);
      assert.equal(Boolean(r.team), needsTeam, r.code);
      if (r.team) assert.ok(TEAMS.includes(r.team), r.code);
    }
  });

  it("route road accidents and fallen debris to Gemini or the keyword matcher (local model has no photos for them)", () => {
    for (const r of reports.filter((x: { ai: { incidentType: string } }) => ["road_accident", "fallen_debris"].includes(x.ai.incidentType))) {
      assert.notEqual(r.ai.provider, "local", r.code);
    }
  });
});
