import test from "node:test";
import assert from "node:assert/strict";
import {
  clientKey,
  corsHeadersFor,
  createRateLimiter,
  fingerprint,
  isAllowedOrigin,
  isDisallowedOrigin,
} from "./security.ts";

// The module only touches Deno.env inside its functions, never at import time,
// so a plain stub lets the same code run under `node --test`.
const DENO_ENV: Record<string, string> = { ALLOWED_ORIGINS: "https://partner.example" };
(globalThis as unknown as { Deno: unknown }).Deno = {
  env: { get: (name: string) => DENO_ENV[name] },
};

test("allows the production and preview Vercel origins", () => {
  assert.equal(isAllowedOrigin("https://chef-fest-ai.vercel.app"), true);
  assert.equal(isAllowedOrigin("https://chef-fest-ai-git-main.vercel.app"), true);
  assert.equal(isAllowedOrigin("https://vercel.app"), true);
});

test("allows local development origins", () => {
  assert.equal(isAllowedOrigin("http://localhost:5173"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3000"), true);
});

test("allows origins listed in ALLOWED_ORIGINS", () => {
  assert.equal(isAllowedOrigin("https://partner.example"), true);
  assert.equal(isAllowedOrigin("https://partner.example/"), true);
});

test("rejects unrelated and malformed origins", () => {
  assert.equal(isAllowedOrigin("https://evil.example"), false);
  // Suffix matching must not be fooled by a lookalike host.
  assert.equal(isAllowedOrigin("https://notvercel.app"), false);
  assert.equal(isAllowedOrigin("https://vercel.app.evil.example"), false);
  assert.equal(isAllowedOrigin("not a url"), false);
});

test("allowAnyOrigin bypasses the allowlist for token-authenticated endpoints", () => {
  assert.equal(isAllowedOrigin("https://evil.example", { allowAnyOrigin: true }), true);
});

test("cors headers echo an allowed origin and never a wildcard", () => {
  const req = new Request("https://api.test", {
    headers: { origin: "https://chef-fest-ai.vercel.app" },
  });
  const headers = corsHeadersFor(req);

  assert.equal(headers["Access-Control-Allow-Origin"], "https://chef-fest-ai.vercel.app");
  assert.notEqual(headers["Access-Control-Allow-Origin"], "*");
  assert.equal(headers.Vary, "Origin");
  assert.match(headers["Access-Control-Allow-Headers"], /x-cirlo-token/);
});

test("cors headers omit the origin when it is not allowed", () => {
  const req = new Request("https://api.test", { headers: { origin: "https://evil.example" } });
  assert.equal(corsHeadersFor(req)["Access-Control-Allow-Origin"], undefined);
});

test("a disallowed origin is detected, a missing one is not", () => {
  const bad = new Request("https://api.test", { headers: { origin: "https://evil.example" } });
  const good = new Request("https://api.test", {
    headers: { origin: "https://chef-fest-ai.vercel.app" },
  });
  const serverToServer = new Request("https://api.test");

  assert.equal(isDisallowedOrigin(bad), true);
  assert.equal(isDisallowedOrigin(good), false);
  assert.equal(isDisallowedOrigin(serverToServer), false);
});

test("rate limiter allows up to the limit then blocks with a retry delay", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
  const now = 1_000_000;

  assert.deepEqual(limiter.check("client", now), { allowed: true, retryAfter: 0, remaining: 2 });
  assert.equal(limiter.check("client", now).allowed, true);
  assert.equal(limiter.check("client", now).allowed, true);

  const blocked = limiter.check("client", now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfter, 60);

  // Counters are per key, so one noisy client cannot throttle another.
  assert.equal(limiter.check("other-client", now).allowed, true);
});

test("rate limiter resets once the window has passed", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

  assert.equal(limiter.check("client", 0).allowed, true);
  assert.equal(limiter.check("client", 500).allowed, false);
  assert.equal(limiter.check("client", 1_001).allowed, true);
});

test("rate limiter stays bounded when many distinct keys arrive", () => {
  const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, maxKeys: 10 });

  for (let i = 0; i < 100; i++) limiter.check(`client-${i}`, 0);

  // Dropping old buckets must not make a single client permanently blocked.
  assert.equal(limiter.check("client-after-flood", 0).allowed, true);
});

test("client key prefers the first forwarded address", () => {
  const req = new Request("https://api.test", {
    headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
  });
  assert.equal(clientKey(req), "203.0.113.7");
  assert.equal(clientKey(new Request("https://api.test")), "unknown");
});

test("fingerprint is stable and does not expose the secret", () => {
  const secret = "cf_live_abcdefghijklmnop";
  const hash = fingerprint(secret);

  assert.equal(hash, fingerprint(secret));
  assert.match(hash, /^[0-9a-f]{8}$/);
  assert.equal(hash.includes("cf_live"), false);
  assert.notEqual(hash, fingerprint("cf_live_abcdefghijklmnoq"));
});
