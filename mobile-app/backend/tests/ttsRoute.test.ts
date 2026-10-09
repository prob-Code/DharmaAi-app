/**
 * Self-executing integration tests for POST /api/ai/tts.
 *
 * A real HTTP server is started on an ephemeral port; Supabase auth and Sarvam
 * are mocked via globalThis.fetch so the auth-first ordering, validation,
 * rate-limiting and provider error mapping can be verified end to end.
 *
 * Run (from backend/):
 *   node node_modules/typescript/bin/tsc --outDir .tmp-test --module commonjs \
 *     --target es2022 --moduleResolution node --esModuleInterop \
 *     --skipLibCheck --strict tests/ttsRoute.test.ts
 *   node .tmp-test/tests/ttsRoute.test.js
 */
import { createServer, Server } from "http";
import { AddressInfo } from "net";
import { createApp } from "../src/app";
import { env } from "../src/config/env";

// Route/environment configuration (mutated in place, same pattern as
// requireAuth.test.ts — no real credentials).
(env as any).SUPABASE_URL = "https://test.supabase.co";
(env as any).SUPABASE_ANON_KEY = "test-anon-key";
(env as any).SARVAM_API_KEY = "test-sarvam-key";

const originalFetch: any = globalThis.fetch;

let authResult: any = { ok: true, status: 200 };
let sarvamResult: any = { ok: true, status: 200, body: { audios: ["QUJD"] } };
let sarvamCalls = 0;

(async () => {
  let passed = 0;
  let failed = 0;
  let server: Server | null = null;
  let baseUrl = "";

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

  async function postTts(body: any, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${baseUrl}/api/ai/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  try {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    // Fetch shim: requests to the local test server pass through to the real
    // fetch; Supabase auth and Sarvam are mocked; everything else fails hard.
    (globalThis as any).fetch = async (url: any, init?: any) => {
      const target = String(url);
      if (target.startsWith("http://127.0.0.1")) {
        return originalFetch(url, init);
      }
      if (target.includes("/auth/v1/user")) {
        return { ok: authResult.ok, status: authResult.status };
      }
      if (target.includes("api.sarvam.ai")) {
        sarvamCalls += 1;
        if (sarvamResult.throw) throw sarvamResult.throw;
        return {
          ok: sarvamResult.ok ?? true,
          status: sarvamResult.status ?? 200,
          json: async () => sarvamResult.body ?? {},
          text: async () => "discarded",
        };
      }
      throw new Error("Unexpected URL in TTS route test: " + target);
    };

    await check("no Authorization header -> 401, Sarvam never called", async () => {
      sarvamCalls = 0;
      const res = await postTts({ text: "hello" });
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
      if (sarvamCalls !== 0) throw new Error("unauthenticated request reached Sarvam");
    });

    await check("invalid token (supabase 401) -> 401", async () => {
      authResult = { ok: false, status: 401 };
      const res = await postTts({ text: "hello" }, { Authorization: "Bearer bad-token" });
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    });

    await check("valid token -> 200 with base64 audio", async () => {
      authResult = { ok: true, status: 200 };
      sarvamResult = { ok: true, status: 200, body: { audios: ["QUJD"] } };
      const res = await postTts({ text: "hello" }, { Authorization: "Bearer good-token" });
      if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
      const data: any = await res.json();
      if (data.audio !== "QUJD") throw new Error(`unexpected audio: ${JSON.stringify(data)}`);
    });

    await check("empty text -> 400", async () => {
      const res = await postTts({ text: "" }, { Authorization: "Bearer good-token" });
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    });

    await check("whitespace-only text -> 400", async () => {
      const res = await postTts({ text: "   " }, { Authorization: "Bearer good-token" });
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    });

    await check("text longer than 1000 chars -> 400", async () => {
      const res = await postTts(
        { text: "x".repeat(1001) },
        { Authorization: "Bearer good-token" }
      );
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    });

    await check("invalid language -> 400", async () => {
      const res = await postTts(
        { text: "hello", language: "fr" },
        { Authorization: "Bearer good-token" }
      );
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    });

    await check("invalid voiceSpeed -> 400", async () => {
      const res = await postTts(
        { text: "hello", voiceSpeed: "turbo" },
        { Authorization: "Bearer good-token" }
      );
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    });

    await check("missing text -> 400", async () => {
      const res = await postTts({ language: "hi" }, { Authorization: "Bearer good-token" });
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    });

    await check("provider timeout -> 504", async () => {
      sarvamResult = { throw: { name: "TimeoutError", message: "aborted" } };
      const res = await postTts({ text: "hello" }, { Authorization: "Bearer good-token" });
      if (res.status !== 504) throw new Error(`expected 504, got ${res.status}`);
    });

    await check("provider unreachable -> 502", async () => {
      sarvamResult = { throw: new Error("network down") };
      const res = await postTts({ text: "hello" }, { Authorization: "Bearer good-token" });
      if (res.status !== 502) throw new Error(`expected 502, got ${res.status}`);
    });

    await check("provider 500 -> 500", async () => {
      sarvamResult = { ok: false, status: 500 };
      const res = await postTts({ text: "hello" }, { Authorization: "Bearer good-token" });
      if (res.status !== 500) throw new Error(`expected 500, got ${res.status}`);
    });

    await check("malformed audio response -> 502", async () => {
      sarvamResult = { ok: true, status: 200, body: { audios: [] } };
      const res = await postTts({ text: "hello" }, { Authorization: "Bearer good-token" });
      if (res.status !== 502) throw new Error(`expected 502, got ${res.status}`);
    });

    await check("rate limit (30/min) -> 429 on 31st request", async () => {
      authResult = { ok: true, status: 200 };
      sarvamResult = { ok: true, status: 200, body: { audios: ["QUJD"] } };
      let lastStatus = 0;
      for (let i = 0; i < 31; i += 1) {
        const res = await postTts({ text: "hello" }, { Authorization: "Bearer good-token" });
        lastStatus = res.status;
      }
      if (lastStatus !== 429) throw new Error(`expected 429 on 31st, got ${lastStatus}`);
    });
  } finally {
    (globalThis as any).fetch = originalFetch;
    const srv = server;
    if (srv) await new Promise<void>((resolve) => srv.close(() => resolve()));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});