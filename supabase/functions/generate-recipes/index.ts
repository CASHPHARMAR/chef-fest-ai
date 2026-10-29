import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

const MAX_INGREDIENTS = 1000;
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
    recipes: {
      type: "array",
      minItems: 1,
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
  required: ["recipes"],
  additionalProperties: false,
};

async function generateWithModel(model: string, ingredients: string) {
  const prompt = `You are a professional chef AI. Given these ingredients: ${ingredients}

Generate 3 diverse recipe suggestions. For each recipe, provide:
1. Recipe name
2. Full ingredients list (including what they provided plus common pantry items)
3. Step-by-step preparation instructions
4. Estimated cook time
5. Difficulty level (Easy/Medium/Hard)
6. Cuisine type
7. A brief description

Format your response as a JSON array of recipes.`;

  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: aiHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a professional chef AI assistant that generates creative, practical recipes. Always respond with valid JSON." },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_recipes",
            description: "Generate recipe suggestions based on available ingredients",
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

  const parsed = JSON.parse(toolCall.function.arguments);
  const recipes = Array.isArray(parsed?.recipes) ? parsed.recipes : [];
  if (recipes.length === 0) {
    throw new UpstreamError(`Model ${model} returned an empty recipe list`);
  }

  return recipes;
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
    const rawIngredients = (body as Record<string, unknown> | null)?.ingredients;
    const ingredients = typeof rawIngredients === "string" ? rawIngredients.trim() : "";

    if (!ingredients) {
      return json({ error: "Please provide some ingredients." }, 400);
    }
    if (ingredients.length > MAX_INGREDIENTS) {
      return json({ error: `Too many ingredients (max ${MAX_INGREDIENTS} characters).` }, 400);
    }

    const models = [PRIMARY_MODEL, FALLBACK_MODEL].filter(
      (model, index, all) => model && all.indexOf(model) === index,
    );

    let lastError: UpstreamError | null = null;
    for (const model of models) {
      try {
        const recipes = await generateWithModel(model, ingredients);
        return json({ recipes });
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
