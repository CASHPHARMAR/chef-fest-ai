# AI backend

All three edge functions call the **Kilo AI gateway**, an OpenAI-compatible
endpoint at `https://ai-gateway.kilo.ai/api/v1/chat/completions`. This replaced
the previous Lovable gateway; no Lovable credentials are required any more.

## Models

Free model ids rotate, so every function reads its model from an env var and
falls back to a second one if the first returns no usable response.

| Function | Env var | Default |
| --- | --- | --- |
| `generate-recipes`, `cirlo-recipe` | `KILO_MODEL` | `kilo-auto/free` |
| `generate-recipes`, `cirlo-recipe` | `KILO_FALLBACK_MODEL` | `nvidia/nemotron-3.5-super-vl:free` |
| `generate-recipes` (validation) | `KILO_VALIDATION_MODELS` | `recursive/flint-v1.0:free,stealth/glyph-cluster,dots-studio/dots-3-note-preview:free` |
| `identify-dish` | `KILO_VISION_MODEL` | `nvidia/nemotron-3.5-super-vl:free` |
| `identify-dish` | `KILO_VISION_FALLBACK_MODEL` | `dots-studio/dots-3-note-preview:free` |

`KILO_VALIDATION_MODELS` is a comma-separated fallback chain for the food
validator. Each model gets exactly one attempt; the first usable answer wins.

`identify-dish` uses a separate pair because vision needs a model that accepts
image input. The `kilo-auto/free` router is text-only, so it is only used for the text functions.

## The blank-response problem

Several free models are reasoning models: they emit a `reasoning` field *and* a
`content` field, and both count against `max_tokens`. With a small budget the
model spends everything on reasoning and the gateway still answers **HTTP 200**
with `content: null` and `finish_reason: "length"`. Observed with
`max_tokens: 300` (`reasoning_tokens: 325`, `content: null`).

The validator therefore:

- requests `max_tokens: 2000`, which leaves room for reasoning plus the answer;
- treats `content: null`, whitespace-only content and `finish_reason: "length"`
  as failures, never as "probably valid";
- moves to the next model in the chain on any failure.

## Optional API key

The gateway accepts unauthenticated requests on the free tier. If you set
`KILO_API_KEY`, all three functions send it as a Bearer token; leave it unset
and they work without one.

```bash
supabase secrets set KILO_API_KEY=... KILO_MODEL=... KILO_VISION_MODEL=... KILO_VALIDATION_MODELS=...
```

Each function also honours `(*_FALLBACK_*)` overrides if you want to pin models.
The key is read with `Deno.env.get` only — never `VITE_*`, so it is never
bundled into the browser build.

## Deployment

Edge functions and `supabase/config.toml` already set `verify_jwt = false` for
all three, because the app has no login and the client only sends the public
anon key.

```bash
supabase functions deploy generate-recipes identify-dish cirlo-recipe
```

## Not-food responses

The models are told to decide first whether the input is real food. Gibberish,
unrelated text, inedible or dangerous items and non-food photos are refused
instead of being turned into invented recipes.

- `generate-recipes` returns `200` with `{ "status": "invalid" | "uncertain", "message": "…" }`
- `identify-dish` returns `200` with `{ "status": "not_food", "message": "…" }`
- successful calls return `{ "status": "ok", "recipes": [...] }` or `{ "status": "ok", "dish": {...} }`
- `cirlo-recipe` returns `422` with a friendly `error` message

`generate-recipes` also keeps accepting the older `not_food` status in the
frontend so a partially deployed backend never renders a broken page.

Free models frequently emit markdown noise (`>`, `:`, `-`) or truncated text in
the `message` field, so each function sanitises it and substitutes its own copy
when the result is not a full sentence.

## Input validation

Validation runs in two layers so neither the browser nor the model is trusted on
its own:

1. **Deterministic** — `supabase/functions/_shared/foodValidation.ts` is imported
   by both `IngredientsInput.tsx` and `generate-recipes`. It rejects empty,
   whitespace-only, symbol/digit-only (counted with `\p{L}`, so non-Latin input
   still passes) and over-long input (`> 1000` chars). The client uses it to
   avoid a pointless request; the edge function uses it as the real boundary and
   answers `400` with `{ "status": "invalid", "error": "…", "problem": "empty" | "too_long" | "no_letters" }`.
2. **Semantic food validation** — `supabase/functions/_shared/foodValidator.ts`
   asks Kilo to classify the input *before* the recipe model runs. The model must
   return strict JSON with `status` in `valid_food | valid_ingredients | invalid |
   uncertain`. Empty content, truncated output, malformed JSON, a schema
   mismatch, a timeout, a 429 or a 5xx are all treated as failures: the next
   model in `KILO_VALIDATION_MODELS` is tried once, and if every model fails the
   function returns `503` instead of generating an unvalidated recipe.

Verdicts returned by `generate-recipes`:

| Verdict | HTTP | Body |
| --- | --- | --- |
| `valid_food` / `valid_ingredients` | 200 | `{ "status": "ok", "recipes": [...] }` |
| `invalid` | 200 | `{ "status": "invalid", "message": "…" }` |
| `uncertain` | 200 | `{ "status": "uncertain", "message": "…" }` |
| validator unavailable | 503 | `{ "status": "unavailable", "error": "…" }` |

The user-facing copy for all three cases lives in `foodValidation.ts`
(`NOT_FOOD_MESSAGE`, `UNCERTAIN_MESSAGE`, `UNAVAILABLE_MESSAGE`) so the frontend
and the server cannot drift. Raw provider errors and stack traces are never
returned to the browser.

The frontend only renders a response that carries `status`, so **deploy the
functions before (or together with) the frontend build**. A Vercel push alone
will leave the page reporting an unexpected response, because the old deployed
function has no `status` field.

Run the tests with `npm test` (Node's built-in runner, no extra dependencies).
The validator tests use a fake `fetch`, so they never call Kilo.

## Before going public

The free tier logs prompts with the upstream provider and offers no uptime
guarantee. It is fine for development, but for production:

- set `KILO_API_KEY` and point the model env vars at a paid model
- add per-IP rate limiting, since these endpoints are callable by anyone
  holding the public anon key
