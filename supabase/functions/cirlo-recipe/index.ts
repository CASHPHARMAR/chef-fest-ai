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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const CIRLO_API_TOKEN = Deno.env.get("CIRLO_API_TOKEN");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!CIRLO_API_TOKEN || !LOVABLE_API_KEY) {
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
              parameters: {
                type: "object",
                properties: {
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
                      required: [
                        "name",
                        "description",
                        "ingredients",
                        "steps",
                        "cookTime",
                        "difficulty",
                        "cuisine",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["recipes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_recipes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Rate limit exceeded. Try again later." }, 429);
      if (response.status === 402) return json({ error: "AI credits exhausted." }, 402);
      console.error("AI gateway error:", response.status, await response.text());
      return json({ error: "Upstream AI error" }, 502);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No recipe generated" }, 502);

    const recipes = JSON.parse(toolCall.function.arguments).recipes ?? [];

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
