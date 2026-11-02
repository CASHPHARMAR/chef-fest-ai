/**
 * Shared CORS and rate limiting for the Chef Fest edge functions.
 *
 * Deno-only: reads `Deno.env`, so it must never be imported by the browser
 * bundle. User-facing copy lives in `foodValidation.ts`, which is shared.
 *
 * Rate limiting is deliberately in-memory. Supabase gives each function isolate
 * its own memory, so a limit is enforced per warm isolate rather than globally:
 * it stops one client hammering the function, but a burst spread across fresh
 * isolates can exceed it. That is enough to protect the shared Kilo free tier
 * from casual abuse without adding a database round-trip to every request.
 */

type CorsOptions = {
  /**
   * Allow any origin. Only for endpoints that authenticate with a bearer token
   * instead of the browser session, so a partner web client is not blocked.
   */
  allowAnyOrigin?: boolean;
};

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** Extra origins from the `ALLOWED_ORIGINS` env var (comma separated). */
const extraOrigins = () =>
  (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

/**
 * The site is served from Vercel, so production plus every preview deployment
 * is the same origin family. Requests without an `Origin` header (curl, the
 * partner's server) are not browser calls and are always allowed.
 */
export function isAllowedOrigin(origin: string, options: CorsOptions = {}): boolean {
  if (options.allowAnyOrigin) return true;
  if (LOCAL_ORIGIN.test(origin)) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol === "https:" && /(^|\.)vercel\.app$/.test(url.hostname)) return true;

  return extraOrigins().includes(origin.replace(/\/$/, ""));
}

/** CORS headers for one request, echoing the origin only when it is allowed. */
export function corsHeadersFor(req: Request, options: CorsOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cirlo-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    // The allowed origin changes per request, so caches must key on it.
    Vary: "Origin",
  };

  const origin = req.headers.get("origin");
  if (origin && isAllowedOrigin(origin, options)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

/** True when the caller is a browser on an origin we do not serve. */
export function isDisallowedOrigin(req: Request, options: CorsOptions = {}): boolean {
  const origin = req.headers.get("origin");
  return Boolean(origin) && !isAllowedOrigin(origin as string, options);
}

export type RateLimitVerdict = {
  allowed: boolean;
  /** Seconds until the window resets, for the `Retry-After` header. */
  retryAfter: number;
  remaining: number;
};

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window limiter. Fixed windows are cheap and predictable; a client can
 * send up to 2x the limit across a window boundary, which is acceptable here.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  /** Safety valve so a flood of distinct keys cannot grow memory without bound. */
  maxKeys?: number;
}) {
  const buckets = new Map<string, Bucket>();
  const maxKeys = options.maxKeys ?? 10_000;

  return {
    check(key: string, now = Date.now()): RateLimitVerdict {
      if (buckets.size >= maxKeys) {
        for (const [bucketKey, bucket] of buckets) {
          if (bucket.resetAt <= now) buckets.delete(bucketKey);
        }
        // Still full of live buckets: drop everything rather than grow forever.
        if (buckets.size >= maxKeys) buckets.clear();
      }

      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + options.windowMs });
        return { allowed: true, retryAfter: 0, remaining: Math.max(options.limit - 1, 0) };
      }

      existing.count += 1;

      if (existing.count > options.limit) {
        return {
          allowed: false,
          retryAfter: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
          remaining: 0,
        };
      }

      return { allowed: true, retryAfter: 0, remaining: options.limit - existing.count };
    },
  };
}

/** Client IP as seen by Supabase's proxy, used for anonymous callers. */
export function clientKey(req: Request): string {
  const forwarded = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return (
    forwarded ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Stable non-reversible key for a secret, so a rate-limit bucket never holds a
 * raw API token in memory.
 */
export function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Reads a positive integer limit from the environment, with a fallback. */
export function limitFromEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
