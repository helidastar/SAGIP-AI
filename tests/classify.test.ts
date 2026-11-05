/**
 * Tests for processReceivedReport (src/lib/reports/classify.ts) — AI 26's last open item,
 * "stuck-report recovery", with a fully mocked Supabase client instead of a live database.
 *
 * The scenario: a report sits at status "received" while classifyReport() runs in the
 * background. If that throws for any reason (a DB write failing, a storage download
 * failing), the report must never be left stuck at "received" forever — it has to move to
 * "pending_review" so a human still sees it, with an audit_logs row recording why.
 *
 * ISS-022's tests/chain.test.ts already covers classifyWithFallback (fallback chain, retry,
 * escalation, budget cap) with a fake Supabase client and fake classifiers; this file applies
 * the same no-live-DB technique to the layer above it, src/lib/reports/classify.ts.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processReceivedReport } from "@/lib/reports/classify";

interface FakeReport {
  id: string;
  description: string;
  area_id: string | null;
  photo_path: string | null;
  status: string;
}

/**
 * Fake Supabase client covering exactly the calls processReceivedReport/classifyReport make:
 * reports (select/update), classifications (insert), audit_logs (insert), and storage.download.
 * `downloadThrows` simulates the unexpected storage failure the recovery path exists for.
 */
function fakeDb(report: FakeReport, opts: { downloadThrows?: boolean } = {}) {
  const calls = {
    reportUpdates: [] as Record<string, unknown>[],
    auditLogs: [] as Record<string, unknown>[],
    classificationInserts: [] as Record<string, unknown>[],
  };

  const db = {
    from(table: string) {
      if (table === "reports") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: report, error: null }) }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              eq: async () => {
                calls.reportUpdates.push(patch);
                return { error: null };
              },
            }),
          }),
        };
      }
      if (table === "classifications") {
        return {
          insert: async (row: Record<string, unknown>) => {
            calls.classificationInserts.push(row);
            return { error: null };
          },
        };
      }
      if (table === "audit_logs") {
        return {
          insert: async (row: Record<string, unknown>) => {
            calls.auditLogs.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`fakeDb: unexpected table "${table}"`);
    },
    storage: {
      from: () => ({
        download: async () => {
          if (opts.downloadThrows) throw new Error("storage unreachable");
          return { data: null, error: null };
        },
      }),
    },
  };

  return { db: db as unknown as SupabaseClient, calls };
}

const baseReport = (over: Partial<FakeReport> = {}): FakeReport => ({
  id: "r1",
  description: "sunog sa balay",
  area_id: null,
  photo_path: null,
  status: "received",
  ...over,
});

afterEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_FALLBACK_PROVIDER;
});

describe("processReceivedReport: stuck-report recovery (AI 26)", () => {
  it("moves a normally-classified report out of received (no error)", async () => {
    // AI_PROVIDER=mock with no fallback configured -> chain falls through to the keyword
    // matcher, same technique chain.test.ts uses to avoid loading the real local model or
    // calling a real network in a test.
    process.env.AI_PROVIDER = "mock";
    const { db, calls } = fakeDb(baseReport());

    await processReceivedReport(db, "r1");

    assert.equal(calls.reportUpdates.length, 1);
    assert.notEqual(calls.reportUpdates[0].status, "received");
    assert.equal(calls.auditLogs.at(-1)?.action, "report_classified");
  });

  it("recovers a report to pending_review when classification throws (storage failure)", async () => {
    process.env.AI_PROVIDER = "mock";
    // photo_path set so classifyReport attempts a storage download, which we make throw -
    // an "unexpected failure (DB, storage)" per the comment in classify.ts.
    const { db, calls } = fakeDb(baseReport({ photo_path: "reports/r1.jpg" }), { downloadThrows: true });

    await processReceivedReport(db, "r1");

    assert.equal(calls.reportUpdates.length, 1);
    assert.equal(calls.reportUpdates[0].status, "pending_review");
    const log = calls.auditLogs.at(-1);
    assert.equal(log?.action, "classification_error");
    assert.equal((log?.after as { status: string }).status, "pending_review");
    assert.match((log?.after as { error: string }).error, /storage unreachable/);
  });

  it("never leaves the report at received, whatever classifyReport throws", async () => {
    process.env.AI_PROVIDER = "mock";
    const { db, calls } = fakeDb(baseReport({ photo_path: "x.jpg" }), { downloadThrows: true });

    await processReceivedReport(db, "r1");

    assert.ok(calls.reportUpdates.every((u) => u.status !== "received"));
  });

  it("does nothing for a report that is not in received status", async () => {
    process.env.AI_PROVIDER = "mock";
    const { db, calls } = fakeDb(baseReport({ status: "pending_review" }));

    await processReceivedReport(db, "r1");

    assert.equal(calls.reportUpdates.length, 0);
    assert.equal(calls.auditLogs.length, 0);
  });
});

describe("classifyReport: saves severity_confidence with every classification (AI 22)", () => {
  it("includes the severity_confidence column on the classifications insert", async () => {
    // Keyword fallback always reports severityConfidence: null (src/lib/ai/keyword.ts) - this
    // isn't about getting a real number out of a model, just confirming the column that
    // Backend 19's migration (0007_severity_confidence.sql) added is actually part of every
    // insert, not silently dropped (the historical bug: computed everywhere, saved nowhere).
    process.env.AI_PROVIDER = "mock";
    const { db, calls } = fakeDb(baseReport());

    await processReceivedReport(db, "r1");

    assert.equal(calls.classificationInserts.length, 1);
    assert.ok("severity_confidence" in calls.classificationInserts[0]);
    assert.equal(calls.classificationInserts[0].severity_confidence, null);
  });
});
