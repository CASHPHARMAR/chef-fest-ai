import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cirlo-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Constant-time-ish comparison to avoid timing leaks
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Kilo gateway is OpenAI-compatible and works without a key on the free tier.
const AI_ENDPOINT = "https://ai-gateway.kilo.ai/api/v1/chat/completions";
const PRIMARY_MODEL = Deno.env.get("KILO_MODEL") ?? "dots-studio/dots-3-note-preview:free";
const FALLBACK_MODEL = Deno.env.get("KILO_FALLBACK_MODEL") ?? "nvidia/nemotron-3.5-super-vl:free";
const KILO_API_KEY = Deno.env.get("KILO_API_KEY");
const AI_TIMEOUT_MS = 60_000;

const aiHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
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

const recipesSchema = {
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

async function generateWithModel(model: string, prompt: string): Promise<unknown[]> {
  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: aiHeaders(),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are Chef Fest AI, a professional chef assistant that generates creative, practical recipes.",
        },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_recipes",
            description: "Generate recipe suggestions",
            parameters: recipesSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_recipes" } },
    }),
  });

  if (!response.ok) {
    console.error(`Kilo gateway ${response.status} for ${model}:`, (await response.text().catch(() => "")).slice(0, 500));
    if (response.status === 429) {
      throw new UpstreamError("Rate limit exceeded. Try again later.", 429);
    }
    throw new UpstreamError(`AI provider error (${response.status})`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new UpstreamError(`Model ${model} returned no recipe data`);
  }

  const recipes = JSON.parse(toolCall.function.arguments).recipes ?? [];
  if (!Array.isArray(recipes) || recipes.length === 0) {
    throw new UpstreamError(`Model ${model} returned an empty recipe list`);
  }

  return recipes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const CIRLO_API_TOKEN = Deno.env.get("CIRLO_API_TOKEN");

  if (!CIRLO_API_TOKEN) {
    console.error("Missing server configuration");
    return json({ error: "Server not configured" }, 500);
  }

  // --- Authentication: Bearer token or x-cirlo-token header ---
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const presented = bearer || (req.headers.get("x-cirlo-token") ?? "").trim();

  if (!presented || !safeEqual(presented, CIRLO_API_TOKEN)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const rawIngredients = (body as Record<string, unknown>).ingredients;
    const rawRequest = (body as Record<string, unknown>).request;
    const rawCount = (body as Record<string, unknown>).count;

    const ingredients = Array.isArray(rawIngredients)
      ? rawIngredients.filter((i) => typeof i === "string").join(", ")
      : typeof rawIngredients === "string"
        ? rawIngredients
        : "";

    const mealRequest = typeof rawRequest === "string" ? rawRequest : "";

    if (!ingredients.trim() && !mealRequest.trim()) {
      return json(
        { error: "Provide 'ingredients' (string or string[]) and/or 'request' (string)." },
        400,
      );
    }
    if (ingredients.length > 2000 || mealRequest.length > 2000) {
      return json({ error: "Input too long (max 2000 characters per field)." }, 400);
    }

    const count = Math.min(Math.max(Number(rawCount) || 3, 1), 5);

    const prompt = [
      `Generate ${count} diverse recipe suggestion(s).`,
      ingredients.trim() ? `Available ingredients: ${ingredients.trim()}` : "",
      mealRequest.trim() ? `Meal request / preferences: ${mealRequest.trim()}` : "",
      "For each recipe include: name, description, full ingredients list, step-by-step instructions, cook time, difficulty (Easy/Medium/Hard) and cuisine.",
    ]
      .filter(Boolean)
      .join("\n");

    const models = [PRIMARY_MODEL, FALLBACK_MODEL].filter(
      (model, index, all) => model && all.indexOf(model) === index,
    );

    let recipes: unknown[] | null = null;
    let lastError: UpstreamError | null = null;

    for (const model of models) {
      try {
        recipes = await generateWithModel(model, prompt);
        break;
      } catch (error) {
        lastError = error instanceof UpstreamError
          ? error
          : new UpstreamError("Unexpected error while generating recipes");
        console.error(`cirlo-recipe: ${model} failed:`, error);
      }
    }

    if (!recipes) {
      return json(
        { error: lastError?.message ?? "Upstream AI error" },
        lastError?.status ?? 502,
      );
    }

    return json({
      source: "chef-fest-ai",
      generatedAt: new Date().toISOString(),
      count: recipes.length,
      recipes,
    });
  } catch (error) {
    console.error("Error in cirlo-recipe:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
