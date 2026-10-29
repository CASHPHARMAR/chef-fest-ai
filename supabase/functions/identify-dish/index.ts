import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Vision needs a model that accepts image input. The free text routers
// (kilo-auto/free) do not, so vision has its own model pair.
const AI_ENDPOINT = "https://ai-gateway.kilo.ai/api/v1/chat/completions";
const PRIMARY_MODEL = Deno.env.get("KILO_VISION_MODEL") ?? "nvidia/nemotron-3.5-super-vl:free";
const FALLBACK_MODEL = Deno.env.get("KILO_VISION_FALLBACK_MODEL") ?? "dots-studio/dots-3-note-preview:free";
const KILO_API_KEY = Deno.env.get("KILO_API_KEY");

// The client downscales to 1200px JPEG, so this only guards against direct abuse.
const MAX_IMAGE_CHARS = 8_000_000;
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

const dishSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    ingredients: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "string" } },
    cuisine: { type: "string" },
    difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
    cookTime: { type: "string" },
  },
  required: ["name", "description", "ingredients", "steps", "cuisine", "difficulty", "cookTime"],
  additionalProperties: false,
};

async function identifyWithModel(model: string, image: string) {
  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: aiHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this food image and identify the dish. Provide the dish name, description, likely ingredients, preparation steps, cuisine type, and difficulty level.",
            },
            {
              type: "image_url",
              image_url: { url: image },
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "identify_dish",
            description: "Identify a dish from a photo",
            parameters: dishSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "identify_dish" } },
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
    throw new UpstreamError(`Model ${model} could not identify the dish`);
  }

  const dish = JSON.parse(toolCall.function.arguments);
  if (!dish || typeof dish.name !== "string" || !dish.name.trim()) {
    throw new UpstreamError(`Model ${model} returned an incomplete dish`);
  }

  return dish;
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
    const rawImage = (body as Record<string, unknown> | null)?.image;
    const image = typeof rawImage === "string" ? rawImage : "";

    if (!image.startsWith("data:image/")) {
      return json({ error: "Please provide an image." }, 400);
    }
    if (image.length > MAX_IMAGE_CHARS) {
      return json({ error: "That image is too large. Please try a smaller photo." }, 413);
    }

    const models = [PRIMARY_MODEL, FALLBACK_MODEL].filter(
      (model, index, all) => model && all.indexOf(model) === index,
    );

    let lastError: UpstreamError | null = null;
    for (const model of models) {
      try {
        const dish = await identifyWithModel(model, image);
        return json({ dish });
      } catch (error) {
        lastError = error instanceof UpstreamError
          ? error
          : new UpstreamError("Unexpected error while identifying the dish");
        console.error(`identify-dish: ${model} failed:`, error);
      }
    }

    return json(
      { error: lastError?.message ?? "Could not identify that dish right now." },
      lastError?.status ?? 502,
    );
  } catch (error) {
    console.error("Error in identify-dish:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
