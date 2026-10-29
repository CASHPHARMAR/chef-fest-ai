/**
 * Semantic food validation for Chef Fest.
 *
 * Runs on the Supabase edge function (Deno) before any recipe is generated, so
 * a caller cannot skip validation by hitting the function directly. The module
 * is dependency-free and takes its fetch implementation as an argument, which
 * keeps it unit-testable in Node without network access.
 *
 * Design rules:
 * - Every model response is untrusted input and must match the schema exactly.
 * - Empty content, truncated content, malformed JSON and HTTP errors are
 *   failures, never "assume valid".
 * - Each model gets exactly one attempt; a failure moves to the next model.
 *   There are no retry loops.
 * - If every model fails we throw ValidationUnavailableError so the caller can
 *   return a temporary-error response instead of generating an unvalidated
 *   recipe.
 */

export const VALIDATION_STATUSES = [
  "valid_food",
  "valid_ingredients",
  "invalid",
  "uncertain",
] as const;

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export interface ValidationResult {
  status: ValidationStatus;
  reason: string;
  normalizedInput: string;
}

/** Default chain: free models verified to return usable JSON for this task. */
export const DEFAULT_VALIDATION_MODELS = [
  "recursive/flint-v1.0:free",
  "stealth/glyph-cluster",
  "dots-studio/dots-3-note-preview:free",
];

export const VALIDATION_TIMEOUT_MS = 20_000;

/**
 * Reasoning models bill their chain of thought against max_tokens. A small
 * budget is spent entirely on `reasoning`, and the API still answers HTTP 200
 * with `content: null` and `finish_reason: "length"` — the blank-response bug.
 * 2000 leaves room for the reasoning plus the short JSON answer.
 */
export const VALIDATION_MAX_TOKENS = 2000;

export const MAX_REASON_LENGTH = 300;
export const MAX_NORMALIZED_LENGTH = 1000;

const SYSTEM_PROMPT = `You are a food-input validator for Chef Fest, an AI cooking platform.
Determine whether the user's input is a recognized food, dish, ingredient, plausible combination of cooking ingredients, or a meaningful food-related cooking request.
Support Ghanaian, African, regional, and international cuisines. Do not reject food merely because it is unfamiliar or locally named.
Reject greetings, random strings, meaningless numbers, non-food objects, and unrelated requests.
Never invent a food identity to make an invalid input pass.
Return only a valid JSON object with exactly these keys:
{"status":"valid_food"|"valid_ingredients"|"invalid"|"uncertain","reason":"short explanation","normalized_input":"cleaned input"}
Use "valid_food" for a dish or drink, "valid_ingredients" for ingredients or a plausible combination, "invalid" for anything that is clearly not food, and "uncertain" when you cannot confidently decide.
If you cannot confidently determine whether the input is food-related, return status "uncertain".`;

export type ValidationFailureKind =
  | "timeout"
  | "rate_limit"
  | "http"
  | "empty"
  | "malformed"
  | "schema";

export class ValidationUnavailableError extends Error {
  kind: ValidationFailureKind;
  status?: number;

  constructor(message: string, kind: ValidationFailureKind, status?: number) {
    super(message);
    this.name = "ValidationUnavailableError";
    this.kind = kind;
    this.status = status;
  }
}

export interface ValidatorDeps {
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  models?: string[];
  timeoutMs?: number;
  endpoint?: string;
}

const DEFAULT_ENDPOINT = "https://ai-gateway.kilo.ai/api/v1/chat/completions";

/**
 * Pulls the first JSON object out of model output. Free models wrap answers in
 * markdown fences or add a sentence before the object, so a bare JSON.parse is
 * not enough. Returns null when no complete object is present.
 */
export function extractJsonObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string") return null;

  let text = raw.trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Validates the model payload against the expected schema. Anything that does
 * not match exactly is rejected, so a model cannot smuggle an arbitrary status
 * or omit fields.
 */
export function parseValidationPayload(
  payload: Record<string, unknown> | null,
  originalInput: string,
): ValidationResult | null {
  if (!payload) return null;

  const status = payload.status;
  if (typeof status !== "string" || !VALIDATION_STATUSES.includes(status as ValidationStatus)) {
    return null;
  }

  const reason = payload.reason;
  if (typeof reason !== "string" || !reason.trim() || reason.length > MAX_REASON_LENGTH) {
    return null;
  }

  const normalizedRaw = payload.normalized_input;
  if (typeof normalizedRaw !== "string" || normalizedRaw.length > MAX_NORMALIZED_LENGTH) {
    return null;
  }

  const normalizedInput = normalizedRaw.trim() || originalInput.trim();
  if (status !== "invalid" && !normalizedInput) return null;

  return {
    status: status as ValidationStatus,
    reason: reason.trim(),
    normalizedInput,
  };
}

const buildHeaders = (apiKey?: string | null) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
};

/**
 * Classifies one input with one model. Throws ValidationUnavailableError for
 * every failure mode so the caller can distinguish "not food" from "we could
 * not check".
 */
export async function classifyWithModel(
  input: string,
  model: string,
  deps: ValidatorDeps = {},
): Promise<ValidationResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const endpoint = deps.endpoint ?? DEFAULT_ENDPOINT;
  const timeoutMs = deps.timeoutMs ?? VALIDATION_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: buildHeaders(deps.apiKey),
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: VALIDATION_MAX_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Input to classify: ${input}` },
        ],
      }),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const kind: ValidationFailureKind = name === "TimeoutError" || name === "AbortError"
      ? "timeout"
      : "http";
    throw new ValidationUnavailableError(`Validator request failed (${kind})`, kind);
  }

  if (!response.ok) {
    // Drain the body so the connection can be reused, but never log it: it can
    // contain provider details that must not reach the user.
    await response.text().catch(() => "");
    if (response.status === 429) {
      throw new ValidationUnavailableError("Validator rate limited", "rate_limit", 429);
    }
    throw new ValidationUnavailableError("Validator returned an error", "http", response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ValidationUnavailableError("Validator returned invalid JSON", "malformed");
  }

  const choice = (body as { choices?: Array<Record<string, unknown>> } | null)?.choices?.[0];
  if (!choice) {
    throw new ValidationUnavailableError("Validator returned no choices", "malformed");
  }
  if (choice.finish_reason === "length") {
    throw new ValidationUnavailableError("Validator output was truncated", "malformed");
  }

  const message = choice.message as { content?: unknown } | undefined;
  const content = message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new ValidationUnavailableError("Validator returned empty content", "empty");
  }

  const parsed = parseValidationPayload(extractJsonObject(content), input);
  if (!parsed) {
    throw new ValidationUnavailableError("Validator returned a malformed payload", "schema");
  }

  return parsed;
}

/**
 * Runs the model chain in order. A model is tried once; the first usable answer
 * wins. If none produce a usable answer, throws ValidationUnavailableError.
 */
export async function validateFoodInput(
  input: string,
  deps: ValidatorDeps = {},
): Promise<ValidationResult> {
  const models = (deps.models ?? DEFAULT_VALIDATION_MODELS).filter(
    (model, index, all) => Boolean(model) && all.indexOf(model) === index,
  );

  if (models.length === 0) {
    throw new ValidationUnavailableError("No validator models configured", "http");
  }

  let lastError: ValidationUnavailableError | null = null;

  for (const model of models) {
    try {
      return await classifyWithModel(input, model, deps);
    } catch (error) {
      lastError = error instanceof ValidationUnavailableError
        ? error
        : new ValidationUnavailableError("Validator failed unexpectedly", "http");
      // Model id and failure kind only: never the user's text or credentials.
      console.error(
        `[food-validator] ${model} failed: ${lastError.kind}${lastError.status ? ` (${lastError.status})` : ""}`,
      );
    }
  }

  throw lastError ?? new ValidationUnavailableError("Validator unavailable", "http");
}

/** Reads the configured model chain from an env var, falling back to defaults. */
export function modelsFromEnv(value: string | undefined | null): string[] {
  const configured = (value ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean)
    .filter((model, index, all) => all.indexOf(model) === index);
  return configured.length > 0 ? configured : [...DEFAULT_VALIDATION_MODELS];
}
