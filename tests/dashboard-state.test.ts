import assert from "node:assert/strict";
import test from "node:test";
import { getIncidentDashboardStatus } from "../src/lib/dashboard-state";

const ready = {
  loading: false,
  error: null,
  preview: null,
  total: 3,
  hasFilters: false,
  visibleCount: 3,
};

test("incident dashboard state distinguishes load, empty, and filtered results", () => {
  assert.equal(getIncidentDashboardStatus({ ...ready, loading: true }), "loading");
  assert.equal(getIncidentDashboardStatus({ ...ready, total: 0, visibleCount: 0 }), "empty");
  assert.equal(
    getIncidentDashboardStatus({ ...ready, total: 0, visibleCount: 0, hasFilters: true }),
    "no-results",
  );
  assert.equal(
    getIncidentDashboardStatus({ ...ready, visibleCount: 0, hasFilters: true }),
    "no-results",
  );
  assert.equal(getIncidentDashboardStatus({ ...ready, visibleCount: 0 }), "no-results");
});

test("incident load failures and development previews have explicit states", () => {
  assert.equal(getIncidentDashboardStatus({ ...ready, error: "Request failed" }), "error");
  assert.equal(getIncidentDashboardStatus({ ...ready, preview: "loading" }), "loading");
  assert.equal(getIncidentDashboardStatus({ ...ready, preview: "empty" }), "empty");
  assert.equal(getIncidentDashboardStatus({ ...ready, preview: "no-results" }), "no-results");
  assert.equal(getIncidentDashboardStatus({ ...ready, preview: "map-error" }), "ready");
});
