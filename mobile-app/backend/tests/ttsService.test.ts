/**
 * Self-executing unit tests for the server-side Sarvam TTS service.
 *
 * Sarvam is mocked via globalThis.fetch so provider timeout, unavailability,
 * failure and malformed-response handling can be verified without credentials.
 *
 * Run (from backend/):
 *   node node_modules/typescript/bin/tsc --outDir .tmp-test --module commonjs \
 *     --target es2022 --moduleResolution node --esModuleInterop \
 *     --skipLibCheck --strict tests/ttsService.test.ts
 *   node .tmp-test/tests/ttsService.test.js
 */
import { synthesizeSpeech } from "../src/services/ttsService";
import { env } from "../src/config/env";

const originalFetch: any = globalThis.fetch;
let lastPayload: any = null;

function mockSarvam(resultOrFn: any): void {
  (globalThis as any).fetch = async (url: string, init?: any) => {
    if (String(url).includes("api.sarvam.ai")) {
      lastPayload = JSON.parse(String((init as any)?.body ?? "{}"));
      if (typeof resultOrFn === "function") {
        return resultOrFn(url, init);
      }
      if (resultOrFn.throw) throw resultOrFn.throw;
      return {
        ok: resultOrFn.ok ?? true,
        status: resultOrFn.status ?? 200,
        json: async () => resultOrFn.body ?? {},
        text: async () => "discarded",
      };
    }
    throw new Error("Unexpected URL in TTS service test: " + url);
  };
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

  function expectStatus(err: any, status: number): void {
    if (!err || err.statusCode !== status) {
      throw new Error(`expected statusCode ${status}, got ${JSON.stringify(err)}`);
    }
  }

  (env as any).SARVAM_API_KEY = "test-sarvam-key";

  await check("success returns base64 audio with preserved bulbul:v3 params", async () => {
    mockSarvam({ ok: true, status: 200, body: { audios: ["QUJD"] } });
    const result = await synthesizeSpeech({ text: "hello there" });
    if (result.audioBase64 !== "QUJD") throw new Error("unexpected audio");
    if (lastPayload.model !== "bulbul:v3") throw new Error("model changed");
    if (lastPayload.speech_sample_rate !== 22050) throw new Error("sample rate changed");
    if (lastPayload.enable_preprocessing !== true) throw new Error("preprocessing changed");
    if (!Array.isArray(lastPayload.inputs) || lastPayload.inputs[0] !== "hello there") {
      throw new Error(`inputs changed: ${JSON.stringify(lastPayload.inputs)}`);
    }
    if (lastPayload.target_language_code !== "en-IN") throw new Error("en language mapping changed");
    if (lastPayload.speaker !== "amit") throw new Error("en speaker changed");
  });

  await check("hindi maps to hi-IN and meera", async () => {
    mockSarvam({ ok: true, status: 200, body: { audios: ["QQ=="] } });
    await synthesizeSpeech({ text: "namaste", language: "hi" });
    if (lastPayload.target_language_code !== "hi-IN") throw new Error("hi mapping changed");
    if (lastPayload.speaker !== "meera") throw new Error("hi speaker changed");
  });

  await check("voice-speed pace mapping preserved (very-slow/normal/slow)", async () => {
    mockSarvam({ ok: true, status: 200, body: { audios: ["QQ=="] } });
    await synthesizeSpeech({ text: "x", voiceSpeed: "very-slow" });
    if (lastPayload.pace !== 0.82) throw new Error(`very-slow pace: ${lastPayload.pace}`);
    await synthesizeSpeech({ text: "x", voiceSpeed: "normal" });
    if (lastPayload.pace !== 0.97) throw new Error(`normal pace: ${lastPayload.pace}`);
    await synthesizeSpeech({ text: "x" });
    if (lastPayload.pace !== 0.9) throw new Error(`default/slow pace: ${lastPayload.pace}`);
  });

  await check("provider timeout -> 504", async () => {
    mockSarvam({ throw: { name: "TimeoutError", message: "aborted" } });
    try {
      await synthesizeSpeech({ text: "hello" });
      throw new Error("expected throw");
    } catch (err: any) {
      expectStatus(err, 504);
    }
  });

  await check("provider unreachable -> 502", async () => {
    mockSarvam({ throw: new Error("network down") });
    try {
      await synthesizeSpeech({ text: "hello" });
      throw new Error("expected throw");
    } catch (err: any) {
      expectStatus(err, 502);
    }
  });

  await check("provider HTTP failure -> status passthrough (500)", async () => {
    mockSarvam({ ok: false, status: 500 });
    try {
      await synthesizeSpeech({ text: "hello" });
      throw new Error("expected throw");
    } catch (err: any) {
      expectStatus(err, 500);
    }
  });

  await check("provider HTTP failure -> status passthrough (429)", async () => {
    mockSarvam({ ok: false, status: 429 });
    try {
      await synthesizeSpeech({ text: "hello" });
      throw new Error("expected throw");
    } catch (err: any) {
      expectStatus(err, 429);
    }
  });

  await check("malformed response (missing audios) -> 502", async () => {
    mockSarvam({ ok: true, status: 200, body: {} });
    try {
      await synthesizeSpeech({ text: "hello" });
      throw new Error("expected throw");
    } catch (err: any) {
      expectStatus(err, 502);
    }
  });

  await check("malformed response (empty audios) -> 502", async () => {
    mockSarvam({ ok: true, status: 200, body: { audios: [] } });
    try {
      await synthesizeSpeech({ text: "hello" });
      throw new Error("expected throw");
    } catch (err: any) {
      expectStatus(err, 502);
    }
  });

  await check("malformed response (non-string audio) -> 502", async () => {
    mockSarvam({ ok: true, status: 200, body: { audios: [12345] } });
    try {
      await synthesizeSpeech({ text: "hello" });
      throw new Error("expected throw");
    } catch (err: any) {
      expectStatus(err, 502);
    }
  });

  await check("unconfigured SARVAM_API_KEY -> throws not-configured", async () => {
    (env as any).SARVAM_API_KEY = "";
    try {
      await synthesizeSpeech({ text: "hello" });
      throw new Error("expected throw");
    } catch (err: any) {
      if (!/not configured/i.test(err?.message ?? "")) {
        throw new Error(`unexpected message: ${err?.message}`);
      }
    } finally {
      (env as any).SARVAM_API_KEY = "test-sarvam-key";
    }
  });

  await check("empty/whitespace text -> throws", async () => {
    mockSarvam({ ok: true, status: 200, body: { audios: ["QQ=="] } });
    try {
      await synthesizeSpeech({ text: "   " });
      throw new Error("expected throw");
    } catch (err: any) {
      if (!/required/i.test(err?.message ?? "")) {
        throw new Error(`unexpected message: ${err?.message}`);
      }
    }
  });

  (globalThis as any).fetch = originalFetch;

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});