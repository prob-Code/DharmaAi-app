/**
 * Self-executing unit tests for the `/api/ai/stt` bearer-token middleware.
 *
 * The Supabase auth service is mocked via globalThis.fetch so the middleware's
 * status/error contract can be verified without real credentials:
 *   401 (missing/invalid/expired token),
 *   403 (token valid but route forbidden),
 *   503 (server auth validation not configured),
 *   504 (auth service timeout/unreachable),
 *   next() on success.
 *
 * Run (from backend/):
 *   node node_modules/typescript/bin/tsc --outDir .tmp-test --module commonjs \
 *     --target es2022 --moduleResolution node --esModuleInterop \
 *     --skipLibCheck --strict tests/requireAuth.test.ts
 *   node .tmp-test/tests/requireAuth.test.js
 */
import { requireAuth } from "../src/middleware/requireAuth";
import { env } from "../src/config/env";

interface Call {
  statusCode: number;
  body: any;
}

function createHarness() {
  const calls: Call[] = [];
  let nextCalled = false;
  const req: any = { headers: {} };
  const res: any = {
    status(code: number) {
      calls.push({ statusCode: code, body: undefined });
      return this;
    },
    json(body: any) {
      const last = calls[calls.length - 1];
      if (last) last.body = body;
      return this;
    },
  };
  const next = () => {
    nextCalled = true;
  };
  return { req, res, next, calls, nextWasCalled: () => nextCalled };
}

const originalFetch: any = globalThis.fetch;

function mockFetch(resultOrFn: any): void {
  (globalThis as any).fetch =
    typeof resultOrFn === "function"
      ? resultOrFn
      : async () => ({ ok: resultOrFn.ok, status: resultOrFn.status });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function check(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      passed += 1;
      console.log(`  PASS ${name}`);
    } catch (err: any) {
      failed += 1;
      console.error(`  FAIL ${name}: ${err?.message ?? String(err)}`);
    }
  }

  (env as any).SUPABASE_URL = "https://test.supabase.co";
  (env as any).SUPABASE_ANON_KEY = "test-anon-key";

  await check("no Authorization header -> 401", async () => {
    const h = createHarness();
    await requireAuth(h.req, h.res, h.next);
    if (h.calls.length !== 1 || h.calls[0].statusCode !== 401) {
      throw new Error(`expected a single 401, got ${JSON.stringify(h.calls)}`);
    }
    if (h.calls[0].body?.error !== "Missing bearer token") {
      throw new Error(`unexpected body ${JSON.stringify(h.calls[0].body)}`);
    }
    if (h.nextWasCalled()) throw new Error("next() must not be called");
  });

  await check("malformed scheme (Token abc) -> 401", async () => {
    const h = createHarness();
    h.req.headers.authorization = "Token abc";
    await requireAuth(h.req, h.res, h.next);
    if (h.calls[0]?.statusCode !== 401) throw new Error("expected 401");
  });

  await check("empty bearer -> 401", async () => {
    const h = createHarness();
    h.req.headers.authorization = "Bearer   ";
    await requireAuth(h.req, h.res, h.next);
    if (h.calls[0]?.statusCode !== 401) throw new Error("expected 401");
  });

  await check("invalid token (supabase 401) -> 401", async () => {
    const h = createHarness();
    h.req.headers.authorization = "Bearer invalid-token";
    mockFetch({ ok: false, status: 401 });
    await requireAuth(h.req, h.res, h.next);
    if (h.calls[0]?.statusCode !== 401) throw new Error("expected 401");
    if (h.calls[0]?.body?.error !== "Missing, invalid, or expired token") {
      throw new Error(`unexpected body ${JSON.stringify(h.calls[0].body)}`);
    }
  });

  await check("valid token -> next()", async () => {
    const h = createHarness();
    h.req.headers.authorization = "Bearer valid-token";
    mockFetch({ ok: true, status: 200 });
    await requireAuth(h.req, h.res, h.next);
    if (!h.nextWasCalled()) throw new Error("expected next() to be called");
    if (h.calls.length !== 0) throw new Error("no response should be written");
  });

  await check("auth service timeout/network -> 504", async () => {
    const h = createHarness();
    h.req.headers.authorization = "Bearer valid-token";
    mockFetch(async () => {
      throw new Error("network down");
    });
    await requireAuth(h.req, h.res, h.next);
    if (h.calls[0]?.statusCode !== 504) {
      throw new Error(`expected 504, got ${h.calls[0]?.statusCode}`);
    }
    if (h.calls[0]?.body?.error !== "Authentication service timed out. Please try again.") {
      throw new Error(`unexpected body ${JSON.stringify(h.calls[0].body)}`);
    }
  });

  await check("token forbidden (supabase 403) -> 403", async () => {
    const h = createHarness();
    h.req.headers.authorization = "Bearer restricted-token";
    mockFetch({ ok: false, status: 403 });
    await requireAuth(h.req, h.res, h.next);
    if (h.calls[0]?.statusCode !== 403) throw new Error("expected 403");
  });

  await check("validation not configured -> 503", async () => {
    const h = createHarness();
    h.req.headers.authorization = "Bearer any-token";
    (env as any).SUPABASE_URL = "";
    await requireAuth(h.req, h.res, h.next);
    if (h.calls[0]?.statusCode !== 503) throw new Error("expected 503");
    if (h.calls[0]?.body?.error !== "Token validation is not configured on the server") {
      throw new Error(`unexpected body ${JSON.stringify(h.calls[0].body)}`);
    }
  });

  (globalThis as any).fetch = originalFetch;
  (env as any).SUPABASE_URL = "https://test.supabase.co";

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});