# AI backend

All three edge functions call the **Kilo AI gateway**, an OpenAI-compatible
endpoint at `https://ai-gateway.kilo.ai/api/v1/chat/completions`. This replaced
the previous Lovable gateway; no Lovable credentials are required any more.

## Models

Free model ids rotate, so every function reads its model from an env var and
falls back to a second one if the first returns no usable tool call.

| Function | Env var | Default |
| --- | --- | --- |
| `generate-recipes`, `cirlo-recipe` | `KILO_MODEL` | `kilo-auto/free` |
| `generate-recipes`, `cirlo-recipe` | `KILO_FALLBACK_MODEL` | `nvidia/nemotron-3.5-super-vl:free` |
| `identify-dish` | `KILO_VISION_MODEL` | `nvidia/nemotron-3.5-super-vl:free` |
| `identify-dish` | `KILO_VISION_FALLBACK_MODEL` | `dots-studio/dots-3-note-preview:free` |

`identify-dish` uses a separate pair because vision needs a model that accepts
image input. The `kilo-auto/free` router is text-only, so it is only used for the text functions.

## Optional API key

The gateway accepts unauthenticated requests on the free tier. If you set
`KILO_API_KEY`, all three functions send it as a Bearer token; leave it unset
and they work without one.

```bash
supabase secrets set KILO_API_KEY=... KILO_MODEL=... KILO_VISION_MODEL=...
```

Each function also honours `(*_FALLBACK_*)` overrides if you want to pin models.

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

- `generate-recipes` returns `200` with `{ "status": "not_food", "message": "…" }`
- `identify-dish` returns `200` with `{ "status": "not_food", "message": "…" }`
- successful calls return `{ "status": "ok", "recipes": [...] }` or `{ "status": "ok", "dish": {...} }`
- `cirlo-recipe` returns `422` with a friendly `error` message

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
   answers `400` with `{ "error": "…", "problem": "empty" | "too_long" | "no_letters" }`.
2. **AI food intent** — everything that survives step 1 goes to the model, which
   must set `status` to `ok` or `not_food`. A missing/invalid `status`, malformed
   JSON or an empty recipe list is treated as a failure, never as a result: the
   fallback model is tried, then the function returns `502`. It never invents a
   recipe because validation failed.

The exact non-food copy for the text flow lives in `NOT_FOOD_MESSAGE` so the
frontend fallback and the server message cannot drift.

The frontend only renders a response that carries `status`, so **deploy the
functions before (or together with) the frontend build**. A Vercel push alone
will leave the page reporting an unexpected response, because the old deployed
function has no `status` field.

Run the tests with `npm test` (Node's built-in runner, no extra dependencies).

## Before going public

The free tier logs prompts with the upstream provider and offers no uptime
guarantee. It is fine for development, but for production:

- set `KILO_API_KEY` and point the model env vars at a paid model
- add per-IP rate limiting, since these endpoints are callable by anyone
  holding the public anon key
