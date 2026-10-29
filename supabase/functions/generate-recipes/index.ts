import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  checkFoodInput,
  NOT_FOOD_MESSAGE,
  UNCERTAIN_MESSAGE,
  UNAVAILABLE_MESSAGE,
} from "../_shared/foodValidation.ts";
import {
  extractJsonObject,
  modelsFromEnv,
  validateFoodInput,
  ValidationUnavailableError,
} from "../_shared/foodValidator.ts";

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

// Server-only. Never expose this through a VITE_* variable or the bundle.
const VALIDATION_MODELS = modelsFromEnv(Deno.env.get("KILO_VALIDATION_MODELS"));

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

The user's input has already been validated as food, so always set status to "ok" and fill recipes with real dishes.

Never invent ingredients to force a recipe. Always respond with valid JSON.`;

async function generateWithModel(model: string, ingredients: string) {
  const prompt = `Ingredients from the user: ${ingredients}

Generate 3 diverse recipe suggestions. For each recipe provide:
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
            description: "Return recipe suggestions for validated food input",
            parameters: recipeSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_recipes" } },
    }),
  });

  if (!response.ok) {
    // Drain the body so the connection is released, but never log it: provider
    // error payloads can echo the prompt back.
    await response.text().catch(() => "");
    console.error(`generate-recipes: upstream HTTP ${response.status} from ${model}`);
    if (response.status === 429) {
      throw new UpstreamError("Rate limit exceeded. Please try again in a moment.", 429);
    }
    throw new UpstreamError(`AI provider error (${response.status})`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const toolArguments = message?.tool_calls?.[0]?.function?.arguments;

  // Some models answer with JSON in `content` instead of a tool call.
  const parsed = toolArguments
    ? extractJsonObject(toolArguments)
    : extractJsonObject(message?.content);

  if (!parsed) {
    throw new UpstreamError(`Model ${model} returned no recipe data`);
  }

  // The generator is only reached after validation, so a not_food answer here
  // means the model disagreed. Treat it as invalid instead of inventing output.
  if (parsed.status === "not_food") {
    return { status: "not_food" as const };
  }

  if (parsed.status !== "ok") {
    throw new UpstreamError(`Model ${model} returned no valid status`);
  }

  const recipes = Array.isArray(parsed.recipes) ? parsed.recipes : [];
  if (recipes.length === 0) {
    throw new UpstreamError(`Model ${model} returned an empty recipe list`);
  }

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
      return json(
        { status: "invalid", error: check.message, problem: check.problem },
        400,
      );
    }

    const ingredients = check.value;

    // Layer B: semantic validation happens before generation and cannot be
    // skipped, because this function is the only path to the recipe model.
    let verdict;
    try {
      verdict = await validateFoodInput(ingredients, {
        apiKey: KILO_API_KEY,
        models: VALIDATION_MODELS,
      });
    } catch (error) {
      if (error instanceof ValidationUnavailableError) {
        // Distinguish "we could not check" from "this is not food": never fall
        // back to unvalidated recipe generation.
        return json({ status: "unavailable", error: UNAVAILABLE_MESSAGE }, 503);
      }
      throw error;
    }

    if (verdict.status === "invalid") {
      return json({ status: "invalid", message: NOT_FOOD_MESSAGE });
    }

    if (verdict.status === "uncertain") {
      return json({ status: "uncertain", message: UNCERTAIN_MESSAGE });
    }

    const recipeInput = verdict.normalizedInput || ingredients;
    const models = [PRIMARY_MODEL, FALLBACK_MODEL].filter(
      (model, index, all) => model && all.indexOf(model) === index,
    );

    let lastError: UpstreamError | null = null;
    for (const model of models) {
      try {
        const result = await generateWithModel(model, recipeInput);
        if (result.status === "not_food") {
          return json({ status: "invalid", message: NOT_FOOD_MESSAGE });
        }
        return json(result);
      } catch (error) {
        lastError = error instanceof UpstreamError
          ? error
          : new UpstreamError("Unexpected error while generating recipes");
        console.error(`generate-recipes: ${model} failed:`, error);
      }
    }

    // Do not leak provider details to the browser.
    return json(
      {
        status: "unavailable",
        error: "We couldn't create recipes right now. Please try again in a moment.",
      },
      lastError?.status === 429 ? 429 : 502,
    );
  } catch (error) {
    console.error("Error in generate-recipes:", error);
    return json(
      { status: "error", error: "Something went wrong. Please try again." },
      500,
    );
  }
});
