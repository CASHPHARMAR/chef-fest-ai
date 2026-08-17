# Chef Fest AI — Cirlo Integration Guide

Give this document to the Cirlo team. **Never put the token in the document itself** — share it separately (password-manager share link or Cirlo's encrypted secrets field).

## Endpoint

```
POST https://lqgdakwtcwkpzpqrlwzn.functions.supabase.co/cirlo-recipe
Content-Type: application/json
Authorization: Bearer <CIRLO_API_TOKEN>
```

`x-cirlo-token: <CIRLO_API_TOKEN>` is accepted as an alternative to the `Authorization` header.

The token is dedicated to Cirlo only. It is not a Chef Fest user token and carries no AI provider credentials — all AI keys stay server-side and are never returned.

## Request body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ingredients` | `string` or `string[]` | one of the two | max 2000 chars |
| `request` | `string` | one of the two | free-form meal request / preferences, max 2000 chars |
| `count` | `number` | no | recipes to generate, 1–5, default 3 |

```json
{
  "ingredients": ["chicken breast", "garlic", "tomatoes"],
  "request": "quick weeknight dinner, low carb",
  "count": 2
}
```

## Response `200`

```json
{
  "source": "chef-fest-ai",
  "generatedAt": "2026-08-17T20:00:00.000Z",
  "count": 2,
  "recipes": [
    {
      "name": "Garlic Tomato Chicken",
      "description": "…",
      "ingredients": ["…"],
      "steps": ["…"],
      "cookTime": "25 minutes",
      "difficulty": "Easy",
      "cuisine": "Mediterranean"
    }
  ]
}
```

## Errors

| Status | Meaning |
| --- | --- |
| 400 | invalid JSON, missing both `ingredients` and `request`, or field over 2000 chars |
| 401 | missing or invalid token |
| 405 | method other than `POST` |
| 429 | rate limit — retry with backoff |
| 402 | AI credits exhausted on the Chef Fest side |
| 502 / 500 | upstream AI or server error |

All errors return `{ "error": "message" }`.

## Example

```bash
curl -X POST https://lqgdakwtcwkpzpqrlwzn.functions.supabase.co/cirlo-recipe \
  -H "Authorization: Bearer $CIRLO_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ingredients":"rice, eggs, spring onion","count":2}'
```

```ts
const res = await fetch("https://lqgdakwtcwkpzpqrlwzn.functions.supabase.co/cirlo-recipe", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.CHEF_FEST_TOKEN}`, // server-side only
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ request: "vegan high-protein lunch", count: 3 }),
});
const data = await res.json();
```

## Security rules for Cirlo

1. Call this endpoint **from Cirlo's server only**. Never ship the token to a browser or mobile client.
2. Store the token in Cirlo's environment/secret manager, not in source control.
3. Cache responses where sensible; respect 429 with exponential backoff.
4. Rotation: Chef Fest issues a new token, Cirlo swaps it in, the old one stops working.

## Token handover checklist (Chef Fest side)

1. Generate: `openssl rand -hex 32`.
2. Save that exact value in Chef Fest as the `CIRLO_API_TOKEN` secret.
3. Send the value to Cirlo via a password-manager share link or their encrypted secrets field — never email or chat.
