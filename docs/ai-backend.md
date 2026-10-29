# AI backend

All three edge functions call the **Kilo AI gateway**, an OpenAI-compatible
endpoint at `https://ai-gateway.kilo.ai/api/v1/chat/completions`. This replaced
the previous Lovable gateway; no Lovable credentials are required any more.

## Models

Free model ids rotate, so every function reads its model from an env var and
falls back to a second one if the first returns no usable tool call.

| Function | Env var | Default |
| --- | --- | --- |
| `generate-recipes`, `cirlo-recipe` | `KILO_MODEL` | `dots-studio/dots-3-note-preview:free` |
| `generate-recipes`, `cirlo-recipe` | `KILO_FALLBACK_MODEL` | `nvidia/nemotron-3.5-super-vl:free` |
| `identify-dish` | `KILO_VISION_MODEL` | `nvidia/nemotron-3.5-super-vl:free` |
| `identify-dish` | `KILO_VISION_FALLBACK_MODEL` | `dots-studio/dots-3-note-preview:free` |

`identify-dish` uses a separate pair because vision needs a model that accepts
image input. The `kilo-auto/free` router is text-only and is not used.

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

## Before going public

The free tier logs prompts with the upstream provider and offers no uptime
guarantee. It is fine for development, but for production:

- set `KILO_API_KEY` and point the model env vars at a paid model
- add per-IP rate limiting, since these endpoints are callable by anyone
  holding the public anon key
