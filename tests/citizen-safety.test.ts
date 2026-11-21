/** Tests for citizen safety guidance (Citizen Portal 4). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INCIDENT_TYPES } from "@/lib/constants";
import { GENERAL_TIPS, SAFETY_TIPS, safetyTipsFor } from "@/lib/citizen/safety";

describe("safetyTipsFor", () => {
  it("has tips for all 8 incident types", () => {
    assert.equal(Object.keys(SAFETY_TIPS).length, INCIDENT_TYPES.length);
    for (const t of INCIDENT_TYPES) assert.ok(SAFETY_TIPS[t].length >= 2, t);
  });
  it("falls back to general tips while the type is unknown", () => {
    assert.deepEqual(safetyTipsFor(null), GENERAL_TIPS);
    assert.deepEqual(safetyTipsFor(undefined), GENERAL_TIPS);
  });
  it("general tips tell the citizen to call 911", () => {
    assert.match(GENERAL_TIPS[0], /911/);
  });
});
