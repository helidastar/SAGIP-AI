/**
 * Tests for API input validation and rate-limiting.
 * ISS-026 – no live Supabase needed; all 4xx checks happen before DB access.
 *
 * Strategy:
 *   - createRateLimiter and clientIp are tested in isolation.
 *   - The route's POST handler is imported via dynamic import AFTER setting
 *     REPORT_RATE_LIMIT=1 so the module-level rate-limiter is initialized with
 *     limit=1, making the 429 test predictable without resetting shared state.
 *   - All 400 validation checks happen before submitReport is called, so no
 *     Supabase credentials are needed for those assertions.
 *   - The 429 test sends a first request (which passes validation but may 500
 *     at the DB layer) and then immediately sends a second request from the same
 *     IP, which must be rejected with 429 and a Retry-After header.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// createRateLimiter – sliding window logic
// ---------------------------------------------------------------------------
describe("createRateLimiter", () => {
  it("allows requests up to the limit", () => {
    const check = createRateLimiter({ limit: 3, windowMs: 60_000 });
    assert.deepEqual(check("ip-a").allowed, true);
    assert.deepEqual(check("ip-a").allowed, true);
    assert.deepEqual(check("ip-a").allowed, true);
  });

  it("blocks the (limit+1)-th request from the same key", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 60_000 });
    check("ip-b");
    check("ip-b");
    const r = check("ip-b");
    assert.equal(r.allowed, false);
  });

  it("retryAfterSeconds is a positive integer when blocked", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000 });
    check("ip-c");
    const r = check("ip-c");
    assert.equal(r.allowed, false);
    assert.ok(typeof r.retryAfterSeconds === "number", "retryAfterSeconds should be a number");
    assert.ok(r.retryAfterSeconds > 0, "retryAfterSeconds should be > 0");
    assert.equal(r.retryAfterSeconds, Math.ceil(r.retryAfterSeconds), "retryAfterSeconds should be a whole number (Math.ceil)");
  });

  it("different keys are tracked independently", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000 });
    check("ip-d");
    const rD = check("ip-d");
    const rE = check("ip-e");
    assert.equal(rD.allowed, false);
    assert.equal(rE.allowed, true);
  });

  it("allowed is true and retryAfterSeconds is 0 for an allowed request", () => {
    const check = createRateLimiter({ limit: 5, windowMs: 60_000 });
    const r = check("ip-f");
    assert.equal(r.allowed, true);
    assert.equal(r.retryAfterSeconds, 0);
  });

  it("requests outside the window are not counted (expired window)", async () => {
    // windowMs = 50ms; after 60ms the hit should have expired
    const check = createRateLimiter({ limit: 1, windowMs: 50 });
    check("ip-g");
    await new Promise((r) => setTimeout(r, 60));
    // The old hit is now outside the window; this should be allowed
    const r = check("ip-g");
    assert.equal(r.allowed, true, "request after window expiry should be allowed");
  });
});

// ---------------------------------------------------------------------------
// clientIp – header parsing
// ---------------------------------------------------------------------------
describe("clientIp", () => {
  function req(headers: Record<string, string>) {
    return new Request("http://localhost/", { headers });
  }

  it("returns first IP from x-forwarded-for (comma-separated)", () => {
    const ip = clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" }));
    assert.equal(ip, "1.2.3.4");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const ip = clientIp(req({ "x-forwarded-for": "  10.0.0.1  , 10.0.0.2" }));
    assert.equal(ip, "10.0.0.1");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const ip = clientIp(req({ "x-real-ip": "192.168.1.1" }));
    assert.equal(ip, "192.168.1.1");
  });

  it("returns 'unknown' when neither header is present", () => {
    const ip = clientIp(req({}));
    assert.equal(ip, "unknown");
  });

  it("returns single IP when x-forwarded-for has no comma", () => {
    const ip = clientIp(req({ "x-forwarded-for": "172.16.0.1" }));
    assert.equal(ip, "172.16.0.1");
  });

  it("x-forwarded-for takes precedence over x-real-ip", () => {
    const ip = clientIp(req({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "9.9.9.9" }));
    assert.equal(ip, "1.2.3.4");
  });
});

// ---------------------------------------------------------------------------
// POST /api/reports – input validation (400) and rate-limit (429)
// ---------------------------------------------------------------------------

// Set REPORT_RATE_LIMIT=1 before the route module is imported so the
// module-level createRateLimiter({ limit: 1 }) picks it up.
process.env.REPORT_RATE_LIMIT = "1";
process.env.REPORT_RATE_WINDOW_MS = "600000";

// Loaded lazily so the env is set first.
let POST: (req: Request) => Promise<Response>;
before(async () => {
  ({ POST } = await import("@/app/api/reports/route"));
});

/** Build a multipart/form-data Request that hits POST /api/reports. */
function makeRequest(fields: Record<string, string | File>, ip = "192.0.2.1"): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request("http://localhost/api/reports", {
    method: "POST",
    body: fd,
    headers: { "x-forwarded-for": ip },
  });
}

/** Parse JSON body from a Response. */
async function json(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("POST /api/reports – input validation (400)", () => {
  // Each test uses a unique IP so the module-level rate limiter (limit=1) doesn't
  // interfere: the first request from each IP always passes the rate-limit gate.
  // Tests that need more than 1 request from the same IP get their own IP range.

  it("missing lat and lng → 400", async () => {
    const res = await POST(makeRequest({ description: "test" }, "192.0.2.10"));
    assert.equal(res.status, 400);
    const body = await json(res);
    assert.ok(typeof body.error === "string");
  });

  it("empty string lat (regression ISS-004: empty string must not coerce to 0) → 400", async () => {
    const res = await POST(makeRequest({ lat: "", lng: "123.88", description: "test" }, "192.0.2.11"));
    assert.equal(res.status, 400);
  });

  it("empty string lng → 400", async () => {
    const res = await POST(makeRequest({ lat: "10.32", lng: "", description: "test" }, "192.0.2.12"));
    assert.equal(res.status, 400);
  });

  it("both lat and lng empty → 400", async () => {
    const res = await POST(makeRequest({ lat: "", lng: "", description: "test" }, "192.0.2.13"));
    assert.equal(res.status, 400);
  });

  it("non-numeric lat → 400", async () => {
    const res = await POST(makeRequest({ lat: "abc", lng: "123.88", description: "test" }, "192.0.2.14"));
    assert.equal(res.status, 400);
  });

  it("non-numeric lng → 400", async () => {
    const res = await POST(makeRequest({ lat: "10.32", lng: "xyz", description: "test" }, "192.0.2.15"));
    assert.equal(res.status, 400);
  });

  it("lat out of range (> 90) → 400", async () => {
    const res = await POST(makeRequest({ lat: "91", lng: "123.88", description: "test" }, "192.0.2.16"));
    assert.equal(res.status, 400);
  });

  it("lat out of range (< -90) → 400", async () => {
    const res = await POST(makeRequest({ lat: "-91", lng: "123.88", description: "test" }, "192.0.2.17"));
    assert.equal(res.status, 400);
  });

  it("lng out of range (> 180) → 400", async () => {
    const res = await POST(makeRequest({ lat: "10.32", lng: "181", description: "test" }, "192.0.2.18"));
    assert.equal(res.status, 400);
  });

  it("lng out of range (< -180) → 400", async () => {
    const res = await POST(makeRequest({ lat: "10.32", lng: "-181", description: "test" }, "192.0.2.19"));
    assert.equal(res.status, 400);
  });

  it("missing both description and photo → 400", async () => {
    const res = await POST(makeRequest({ lat: "10.32", lng: "123.88" }, "192.0.2.20"));
    assert.equal(res.status, 400);
    const body = await json(res);
    assert.ok(String(body.error).toLowerCase().includes("description") || String(body.error).toLowerCase().includes("photo"));
  });

  it("empty description with no photo → 400", async () => {
    const res = await POST(makeRequest({ lat: "10.32", lng: "123.88", description: "" }, "192.0.2.21"));
    assert.equal(res.status, 400);
  });

  it("non-image file upload (text/plain) → 400", async () => {
    const file = new File(["hello world"], "test.txt", { type: "text/plain" });
    const fd = new FormData();
    fd.append("lat", "10.32");
    fd.append("lng", "123.88");
    fd.append("photo", file);
    const res = await POST(new Request("http://localhost/api/reports", {
      method: "POST", body: fd, headers: { "x-forwarded-for": "192.0.2.22" },
    }));
    assert.equal(res.status, 400);
    const body = await json(res);
    assert.ok(String(body.error).includes("image"));
  });

  it("oversized image (> 10 MB) → 400", async () => {
    // 10 MB + 1 byte
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    const fd = new FormData();
    fd.append("lat", "10.32");
    fd.append("lng", "123.88");
    fd.append("photo", big);
    const res = await POST(new Request("http://localhost/api/reports", {
      method: "POST", body: fd, headers: { "x-forwarded-for": "192.0.2.23" },
    }));
    assert.equal(res.status, 400);
    const body = await json(res);
    assert.ok(String(body.error).includes("10MB") || String(body.error).includes("image"));
  });

  it("exactly 90 lat is valid (boundary)", async () => {
    // This passes all validation; will fail at DB level (500) without Supabase,
    // but must NOT be 400.
    const res = await POST(makeRequest({ lat: "90", lng: "123.88", description: "boundary test" }, "192.0.2.24"));
    assert.notEqual(res.status, 400, `Expected non-400 for lat=90; got ${res.status}`);
  });

  it("exactly 180 lng is valid (boundary)", async () => {
    const res = await POST(makeRequest({ lat: "10", lng: "180", description: "boundary test" }, "192.0.2.25"));
    assert.notEqual(res.status, 400, `Expected non-400 for lng=180; got ${res.status}`);
  });
});

describe("POST /api/reports – rate limiting (429)", () => {
  // The route's rate limiter is initialized with limit=1 (set at top of file).
  // We use a dedicated IP for this suite so it's isolated from the 400 tests above.
  const RATE_IP = "203.0.113.42";

  it("first request passes rate-limit gate (may 500 at DB layer without Supabase)", async () => {
    const res = await POST(makeRequest({ lat: "10.32", lng: "123.88", description: "first" }, RATE_IP));
    // Should NOT be 429; may be 500 (no Supabase) or 201 (if Supabase is configured)
    assert.notEqual(res.status, 429, `First request should not be rate-limited; got ${res.status}`);
  });

  it("second request from same IP within window → 429 with Retry-After header", async () => {
    // At this point the limiter has 1 hit from RATE_IP; limit=1 means next is blocked.
    const res = await POST(makeRequest({ lat: "10.32", lng: "123.88", description: "second" }, RATE_IP));
    assert.equal(res.status, 429);
    const retryAfter = res.headers.get("retry-after");
    assert.ok(retryAfter !== null, "Retry-After header must be present on 429");
    const secs = Number(retryAfter);
    assert.ok(Number.isFinite(secs) && secs > 0, `Retry-After must be a positive number, got: ${retryAfter}`);
  });

  it("different IP is not rate-limited", async () => {
    const OTHER_IP = "203.0.113.99";
    const res = await POST(makeRequest({ lat: "10.32", lng: "123.88", description: "other ip" }, OTHER_IP));
    assert.notEqual(res.status, 429, `A different IP should not be rate-limited; got ${res.status}`);
  });
});

