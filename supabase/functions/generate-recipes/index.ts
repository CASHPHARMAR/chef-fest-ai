import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  checkFoodInput,
  NOT_FOOD_MESSAGE,
} from "../_shared/foodValidation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Kilo gateway is OpenAI-compatible and works without a key on the free tier.
// Both models are overridable by env var because free model ids rotate often.
const AI_ENDPOINT = "https://ai-gateway.kilo.ai/api/v1/chat/completions";
const PRIMARY_MODEL = Deno.env.get("KILO_MODEL") ?? "dots-studio/dots-3-note-preview:free";
const FALLBACK_MODEL = Deno.env.get("KILO_FALLBACK_MODEL") ?? "nvidia/nemotron-3.5-super-vl:free";
const KILO_API_KEY = Deno.env.get("KILO_API_KEY");

const MAX_RECIPES = 3;
const REQUEST_TIMEOUT_MS = 60_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const aiHeaders = () => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (KILO_API_KEY) headers.Authorization = `Bearer ${KILO_API_KEY}`;
  return headers;
};

/**
 * Free models often emit markdown noise (">", ":", "-") or a truncated string in
 * the message field, so anything that is not a real sentence falls back to our
 * own copy. The user must never see ":" as an explanation.
 */
const cleanMessage = (raw: unknown, fallback: string) => {
  if (typeof raw !== "string") return fallback;
  const text = raw
    .replace(/^[\s>:#*_\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length >= 25 ? text : fallback;
};

class UpstreamError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const recipeSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["ok", "not_food"],
      description: "Whether the input could be turned into real recipes.",
    },
    message: {
      type: "string",
      description: "Friendly message for the user. Only meaningful when status is not_food; otherwise empty.",
    },
    recipes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          ingredients: { type: "array", items: { type: "string" } },
          steps: { type: "array", items: { type: "string" } },
          cookTime: { type: "string" },
          difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
          cuisine: { type: "string" },
        },
        required: ["name", "description", "ingredients", "steps", "cookTime", "difficulty", "cuisine"],
        additionalProperties: false,
      },
    },
  },
  required: ["status", "message", "recipes"],
  additionalProperties: false,
};

const systemPrompt = `You are a professional chef AI assistant that generates creative, practical recipes.

Before writing anything, decide whether the user's text describes real food, drink or cooking ingredients.

- If it does, set status to "ok", leave message empty, and fill recipes with real dishes.
- If it does not, set status to "not_food", leave recipes as an empty array, and write a short, warm message explaining you could not find recipes for what they typed, then invite them to list real ingredients.

Treat these as not_food: random characters ("asdfghjkl", "qwerty"), unrelated words ("my homework", "battery acid"), inedible or dangerous items ("plastic", "bleach", "glass"), single letters, and empty or meaningless input.

Never invent ingredients to force a recipe. Guessing is worse than saying you do not know. Always respond with valid JSON.`;

async function generateWithModel(model: string, ingredients: string) {
  const prompt = `Ingredients from the user: ${ingredients}

If the text above is real food, generate 3 diverse recipe suggestions. For each recipe provide:
1. Recipe name
2. Full ingredients list (including what they provided plus common pantry items)
3. Step-by-step preparation instructions
4. Estimated cook time
5. Difficulty level (Easy/Medium/Hard)
6. Cuisine type
7. A brief description`;

  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: aiHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_recipes",
            description: "Return either recipes, or a friendly explanation that the input was not food",
            parameters: recipeSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_recipes" } },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Kilo gateway ${response.status} for ${model}:`, detail.slice(0, 500));
    if (response.status === 429) {
      throw new UpstreamError("Rate limit exceeded. Please try again in a moment.", 429);
    }
    throw new UpstreamError(`AI provider error (${response.status})`);
  }

  const data = await response.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new UpstreamError(`Model ${model} returned no recipe data`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new UpstreamError(`Model ${model} returned malformed JSON`);
  }

  const payload = parsed as Record<string, unknown> | null;

  // A missing or unknown status means we cannot tell whether this is food. Do
  // not guess: fail over to the fallback model, and 502 if that fails too.
  if (payload?.status !== "ok" && payload?.status !== "not_food") {
    throw new UpstreamError(`Model ${model} returned no valid status`);
  }

  // The model decided the input was not food: show a friendly message.
  if (payload.status === "not_food") {
    return { status: "not_food" as const, message: cleanMessage(payload.message, NOT_FOOD_MESSAGE) };
  }

  const recipes = Array.isArray(payload.recipes) ? payload.recipes : [];
  if (recipes.length === 0) {
    throw new UpstreamError(`Model ${model} returned an empty recipe list`);
  }

  // Models occasionally ignore the "3 recipes" instruction; keep the page sane.
  return { status: "ok" as const, recipes: recipes.slice(0, MAX_RECIPES) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const check = checkFoodInput((body as Record<string, unknown> | null)?.ingredients);

    // Empty, whitespace-only, symbol/digit-only and over-long input never reach
    // the AI, so a bad request cannot cost tokens or invent a recipe.
    if (check.ok === false) {
      return json({ error: check.message, problem: check.problem }, 400);
    }

    const ingredients = check.value;

    const models = [PRIMARY_MODEL, FALLBACK_MODEL].filter(
      (model, index, all) => model && all.indexOf(model) === index,
    );

    let lastError: UpstreamError | null = null;
    for (const model of models) {
      try {
        const result = await generateWithModel(model, ingredients);
        return json(result);
      } catch (error) {
        lastError = error instanceof UpstreamError
          ? error
          : new UpstreamError("Unexpected error while generating recipes");
        console.error(`generate-recipes: ${model} failed:`, error);
      }
    }

    return json(
      { error: lastError?.message ?? "Could not generate recipes right now." },
      lastError?.status ?? 502,
    );
  } catch (error) {
    console.error("Error in generate-recipes:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
