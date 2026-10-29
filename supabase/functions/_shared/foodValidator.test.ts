import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyWithModel,
  extractJsonObject,
  modelsFromEnv,
  parseValidationPayload,
  validateFoodInput,
  ValidationUnavailableError,
  DEFAULT_VALIDATION_MODELS,
} from "./foodValidator.ts";

const completion = (message: unknown, finishReason = "stop") =>
  new Response(
    JSON.stringify({ choices: [{ index: 0, finish_reason: finishReason, message }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

const jsonMessage = (payload: unknown) =>
  completion({ role: "assistant", content: JSON.stringify(payload) });

const validPayload = {
  status: "valid_food",
  reason: "A recognized West African dish.",
  normalized_input: "jollof rice",
};

const invalidPayload = {
  status: "invalid",
  reason: "A greeting is not food.",
  normalized_input: "",
};

const expectUnavailable = async (promise: Promise<unknown>, kind: string) => {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ValidationUnavailableError, "expected ValidationUnavailableError");
    assert.equal(error.kind, kind);
    return true;
  });
};

test("extractJsonObject reads plain JSON", () => {
  assert.deepEqual(extractJsonObject(JSON.stringify(validPayload)), validPayload);
});

test("extractJsonObject strips markdown fences", () => {
  const raw = "```json\n" + JSON.stringify(validPayload, null, 2) + "\n```";
  assert.deepEqual(extractJsonObject(raw), validPayload);
});

test("extractJsonObject tolerates leading prose and leading newlines", () => {
  assert.deepEqual(
    extractJsonObject(`\n\nSure, here is the result: ${JSON.stringify(validPayload)}`),
    validPayload,
  );
});

test("extractJsonObject returns null for blank or malformed output", () => {
  for (const raw of ["", "   ", null, undefined, 42, "no json here", "{broken", "```json\nnot json\n```"]) {
    assert.equal(extractJsonObject(raw), null, String(raw));
  }
});

test("parseValidationPayload accepts every allowed status", () => {
  for (const status of ["valid_food", "valid_ingredients", "invalid", "uncertain"]) {
    const result = parseValidationPayload(
      { status, reason: "because", normalized_input: "thing" },
      "thing",
    );
    assert.equal(result?.status, status);
  }
});

test("parseValidationPayload rejects an unknown status", () => {
  assert.equal(
    parseValidationPayload({ status: "maybe", reason: "x", normalized_input: "x" }, "x"),
    null,
  );
});

test("parseValidationPayload rejects missing or malformed fields", () => {
  const cases: unknown[] = [
    null,
    {},
    { status: "invalid" },
    { status: "invalid", reason: "" },
    { status: "invalid", reason: 42, normalized_input: "" },
    { status: "invalid", reason: "x", normalized_input: 42 },
    { status: "invalid", reason: "x".repeat(301), normalized_input: "" },
    { status: "invalid", reason: "x", normalized_input: "y".repeat(1001) },
  ];
  for (const payload of cases) {
    assert.equal(
      parseValidationPayload(payload as Record<string, unknown> | null, "input"),
      null,
      JSON.stringify(payload),
    );
  }
});

test("parseValidationPayload falls back to the original input when normalized input is empty", () => {
  const result = parseValidationPayload(
    { status: "valid_food", reason: "ok", normalized_input: "  " },
    "  Jollof Rice  ",
  );
  assert.equal(result?.normalizedInput, "Jollof Rice");
});

test("classifyWithModel returns a valid verdict", async () => {
  const result = await classifyWithModel("jollof rice", "test-model", {
    fetchImpl: (async () => jsonMessage(validPayload)) as typeof fetch,
  });
  assert.deepEqual(result, {
    status: "valid_food",
    reason: "A recognized West African dish.",
    normalizedInput: "jollof rice",
  });
});

test("classifyWithModel treats null content as a safe failure (blank-response bug)", async () => {
  await expectUnavailable(
    classifyWithModel("jollof rice", "test-model", {
      fetchImpl: (async () => completion({ role: "assistant", content: null })) as typeof fetch,
    }),
    "empty",
  );
});

test("classifyWithModel treats whitespace-only content as a safe failure", async () => {
  await expectUnavailable(
    classifyWithModel("jollof rice", "test-model", {
      fetchImpl: (async () => completion({ role: "assistant", content: "  \n\t " })) as typeof fetch,
    }),
    "empty",
  );
});

test("classifyWithModel rejects truncated output even when content exists", async () => {
  await expectUnavailable(
    classifyWithModel("jollof rice", "test-model", {
      fetchImpl: (async () => completion({ content: '{"status":"valid_' }, "length")) as typeof fetch,
    }),
    "malformed",
  );
});

test("classifyWithModel rejects malformed JSON", async () => {
  await expectUnavailable(
    classifyWithModel("jollof rice", "test-model", {
      fetchImpl: (async () => completion({ content: "I think this is food." })) as typeof fetch,
    }),
    "schema",
  );
});

test("classifyWithModel rejects schema violations", async () => {
  await expectUnavailable(
    classifyWithModel("jollof rice", "test-model", {
      fetchImpl: (async () => jsonMessage({ status: "definitely_food" })) as typeof fetch,
    }),
    "schema",
  );
});

test("classifyWithModel surfaces HTTP 429 as a rate-limit failure", async () => {
  await expectUnavailable(
    classifyWithModel("jollof rice", "test-model", {
      fetchImpl: (async () => new Response("slow down", { status: 429 })) as typeof fetch,
    }),
    "rate_limit",
  );
});

test("classifyWithModel surfaces HTTP 5xx as an upstream failure", async () => {
  await expectUnavailable(
    classifyWithModel("jollof rice", "test-model", {
      fetchImpl: (async () => new Response("boom", { status: 500 })) as typeof fetch,
    }),
    "http",
  );
});

test("classifyWithModel treats a timeout as a safe failure", async () => {
  await expectUnavailable(
    classifyWithModel("jollof rice", "test-model", {
      fetchImpl: (async () => {
        const error = new Error("timed out");
        error.name = "TimeoutError";
        throw error;
      }) as typeof fetch,
    }),
    "timeout",
  );
});

test("validateFoodInput falls back to the next model after a blank answer", async () => {
  const seen: string[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const model = JSON.parse(String(init.body)).model;
    seen.push(model);
    if (model === "first") return completion({ content: null });
    return jsonMessage(validPayload);
  }) as unknown as typeof fetch;

  const result = await validateFoodInput("jollof rice", {
    models: ["first", "second"],
    fetchImpl,
  });

  assert.equal(result.status, "valid_food");
  assert.deepEqual(seen, ["first", "second"]);
});

test("validateFoodInput throws when every model fails", async () => {
  const fetchImpl = (async () => new Response("nope", { status: 503 })) as typeof fetch;

  await expectUnavailable(
    validateFoodInput("jollof rice", { models: ["a", "b"], fetchImpl }),
    "http",
  );
});

test("validateFoodInput never treats an empty chain as valid", async () => {
  await expectUnavailable(validateFoodInput("jollof rice", { models: [] }), "http");
});

test("modelsFromEnv parses a comma-separated list and removes duplicates", () => {
  assert.deepEqual(modelsFromEnv(" a , b ,a, "), ["a", "b"]);
});

test("modelsFromEnv falls back to the default chain", () => {
  for (const value of [undefined, null, "", "  "]) {
    assert.deepEqual(modelsFromEnv(value), [...DEFAULT_VALIDATION_MODELS]);
  }
});
