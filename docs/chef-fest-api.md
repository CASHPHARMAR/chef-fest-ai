# Chef Fest AI — Recipe Generation API

A single HTTP endpoint that turns a list of ingredients (and/or a meal request)
into finished recipes. Chef Fest does the AI work, food validation and prompt
engineering; the integrating project just posts ingredients and renders the
result.

The API token is **not** in this document. It is shared separately — keep it in
a server-side secret store (environment variable or your host's secret manager),
never in client-side code or a public repo.

---

## 1. Endpoint

```
POST https://axwawznpqznnladmtvnp.functions.supabase.co/cirlo-recipe
Content-Type: application/json
```

Synchronous. Typical latency is 5–30 seconds per request because a language
model is generating the recipes. **Set your client timeout to at least 90
seconds** — the default 10–30s of most HTTP clients will time out on valid
requests.

There is no streaming, no webhook, and no job queue: one request returns the
finished recipes.

---

## 2. Authentication

Send the token one of two ways — both are accepted:

```http
Authorization: Bearer <API_TOKEN>
```

```http
x-cirlo-token: <API_TOKEN>
```

A missing or wrong token returns `401`. Use `Authorization` unless something in
your stack already reserves that header.

> The endpoint accepts calls from any browser origin, so a web front end can
> call it directly. Even so, **keep the token on your server** and proxy through
> it. A token in a browser bundle is readable by anyone.

---

## 3. Request body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ingredients` | `string` or `string[]` | one of these two | What the user has. An array is joined automatically. |
| `request` | `string` | one of these two | Free-text meal request, e.g. `"quick vegetarian dinner"`. |
| `count` | `number` | no | Recipes to return, `1`–`5`. Default `3`. |

Limits: each string field is capped at **2000 characters**. Send at least one of
`ingredients` or `request`; sending neither returns `400`.

```json
{
  "ingredients": ["rice", "eggs", "spring onion"],
  "request": "quick dinner",
  "count": 2
}
```

---

## 4. Successful response — `200`

```json
{
  "source": "chef-fest-ai",
  "generatedAt": "2026-11-02T16:42:11.083Z",
  "count": 2,
  "recipes": [
    {
      "name": "Egg Fried Rice",
      "description": "A fast one-pan rice dish using leftover rice and eggs.",
      "ingredients": ["2 cups cooked rice", "3 eggs", "2 spring onions", "2 tbsp oil", "1 tbsp soy sauce"],
      "steps": [
        "Heat the oil in a wok over high heat.",
        "Scramble the eggs, then push them to one side.",
        "Add the rice and fry for 3 minutes, breaking up clumps.",
        "Stir through the soy sauce and spring onions and serve."
      ],
      "cookTime": "15 minutes",
      "difficulty": "Easy",
      "cuisine": "Chinese"
    }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `recipes[].name` | `string` | Dish name |
| `recipes[].description` | `string` | One or two sentences |
| `recipes[].ingredients` | `string[]` | Includes the user's items plus pantry staples |
| `recipes[].steps` | `string[]` | Ordered preparation steps |
| `recipes[].cookTime` | `string` | Free text, e.g. `"15 minutes"` |
| `recipes[].difficulty` | `"Easy"` \| `"Medium"` \| `"Hard"` | Safe to map to an enum |
| `recipes[].cuisine` | `string` | Free text, e.g. `"Chinese"` |

`count` is the number actually returned, so treat `recipes.length` as the source
of truth rather than assuming it equals what you asked for.

---

## 5. Errors

All errors return a JSON body with a single `error` string:

```json
{ "error": "Provide 'ingredients' (string or string[])." }
```

| Status | Meaning | What to do |
| --- | --- | --- |
| `400` | Invalid JSON, neither field supplied, or a field over 2000 chars | Fix the request; surface the message to the developer, not the end user |
| `401` | Missing or wrong token | Check the server-side secret |
| `405` | Method other than `POST` | Fix the call |
| `422` | Input was not about real food | Show `error` to the user — this copy is written for them |
| `429` | Rate limited | Honour `Retry-After`, back off, show a friendly retry message |
| `500` / `502` | Server or upstream AI failure | Retry once, then show a generic "try again shortly" message |

Error strings never contain model names or provider details, so they are safe to
log. The one message written for end users is the `422` one.

### Example `422`

```json
{
  "error": "Hmm, we couldn't identify any food or ingredients in your input. 🍅 Please enter a food name, dish, or ingredients so we can help you create a delicious recipe!"
}
```

**Important behaviour:** the API never fabricates a recipe from non-food input.
If the input is meaningless, a non-food item or random characters, you get `422`
and no recipes. Design your UI to show that message rather than treating it as a
crash.

---

## 6. Rate limits

1. **Per token: 20 requests per minute.** Exceeding it returns `429` with a
   `Retry-After` header (seconds).
2. **Shared upstream budget: roughly 200 generations per hour** across Chef Fest
   and all integrations. The per-token ceiling is set below that on purpose, but
   a heavy hour from another caller can still reach the shared ceiling.

Guidance:

- Generate on user action only — never poll or batch.
- Cache results per request signature for at least a few minutes.
- Treat `429` as expected: read `Retry-After`, back off exponentially, and tell
  the user to try again shortly.
- If expected volume is more than occasional, send a traffic forecast so the
  per-token ceiling can be raised **before** launch. It is configurable
  server-side per integration.

---

## 7. Copy-paste examples

### curl

```bash
export CHEF_FEST_TOKEN="<API_TOKEN>"

curl -X POST "https://axwawznpqznnladmtvnp.functions.supabase.co/cirlo-recipe" \
  -H "Authorization: Bearer $CHEF_FEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ingredients":"rice, eggs, spring onion","count":2}'
```

### JavaScript / TypeScript (server-side)

```ts
type Recipe = {
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  cookTime: string;
  difficulty: "Easy" | "Medium" | "Hard";
  cuisine: string;
};

type RecipeResponse = {
  source: "chef-fest-ai";
  generatedAt: string;
  count: number;
  recipes: Recipe[];
};

export async function generateRecipes(
  ingredients: string | string[],
  count = 3,
  request?: string,
): Promise<RecipeResponse | { error: string }> {
  const res = await fetch(
    "https://axwawznpqznnladmtvnp.functions.supabase.co/cirlo-recipe",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CHEF_FEST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ingredients, count, request }),
      signal: AbortSignal.timeout(90_000),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    // 429 also carries a Retry-After header (seconds).
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? 60);
      // schedule a retry / show a "one moment" state
      console.warn(`Rate limited, retry in ${retryAfter}s`);
    }
    return { error: data.error ?? "Something went wrong." };
  }

  return data as RecipeResponse;
}
```

### Python

```python
import os
import requests

resp = requests.post(
    "https://axwawznpqznnladmtvnp.functions.supabase.co/cirlo-recipe",
    headers={"Authorization": f"Bearer {os.environ['CHEF_FEST_TOKEN']}"},
    json={"ingredients": ["rice", "eggs", "spring onion"], "count": 2},
    timeout=90,
)

if resp.status_code == 429:
    retry_after = int(resp.headers.get("Retry-After", 60))
    # back off and retry later
elif not resp.ok:
    print(resp.json().get("error"))
else:
    for recipe in resp.json()["recipes"]:
        print(recipe["name"], "-", recipe["cookTime"])
```

---

## 8. Integration checklist

- [ ] Token stored as a server-side secret, not in the client bundle or repo.
- [ ] HTTP timeout raised to at least 90 seconds.
- [ ] A loading state that survives 5–30 seconds of generation.
- [ ] `422` message shown to the user as a normal answer, not an error crash.
- [ ] `429` handled with `Retry-After` and exponential backoff.
- [ ] `difficulty` mapped to an enum, other fields rendered as free text.
- [ ] Results cached per request signature.
- [ ] Traffic forecast shared with Chef Fest before launch.

---

## 9. Support

Endpoint, token and limits are managed by Chef Fest. If you need a higher
per-token ceiling, a different response shape, a longer timeout, or a webhook
flow, ask before building workarounds. Rotating the token takes effect
immediately and invalidates the old one.
