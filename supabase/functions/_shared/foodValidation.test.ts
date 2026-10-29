import test from "node:test";
import assert from "node:assert/strict";

import {
  checkFoodInput,
  MAX_INGREDIENTS,
  NOT_FOOD_MESSAGE,
  UNCERTAIN_MESSAGE,
  UNAVAILABLE_MESSAGE,
  EMPTY_MESSAGE,
} from "./foodValidation.ts";

const rejected = (input: unknown) => {
  const result = checkFoodInput(input);
  assert.equal(result.ok, false, `expected "${String(input)}" to be rejected`);
  return result as Extract<typeof result, { ok: false }>;
};

const accepted = (input: unknown) => {
  const result = checkFoodInput(input);
  assert.equal(result.ok, true, `expected "${String(input)}" to be accepted`);
  return (result as Extract<typeof result, { ok: true }>).value;
};

test("rejects empty and whitespace-only input", () => {
  for (const input of ["", " ", "   ", "\n", "\t \n "]) {
    assert.equal(rejected(input).problem, "empty");
  }
});

test("rejects non-string input", () => {
  for (const input of [null, undefined, 42, {}, []]) {
    assert.equal(rejected(input).problem, "empty");
  }
});

test("rejects symbol-only input", () => {
  for (const input of ["@@@", "!!!", "###", "$$$", ">>>", "&&&", "()[]{}", "+++", "%^&*"]) {
    assert.equal(rejected(input).problem, "no_letters", input);
    assert.equal(rejected(input).message, NOT_FOOD_MESSAGE);
  }
});

test("rejects digit-only input", () => {
  for (const input of ["12345", "0", "3.14", "1 2 3"]) {
    assert.equal(rejected(input).problem, "no_letters", input);
  }
});

test("rejects a single letter, which cannot be a food", () => {
  assert.equal(rejected("x").problem, "no_letters");
  assert.equal(rejected("a").problem, "no_letters");
});

test("rejects input longer than the limit", () => {
  assert.equal(rejected("a".repeat(MAX_INGREDIENTS + 1)).problem, "too_long");
});

test("accepts input at exactly the limit", () => {
  assert.equal(accepted("a".repeat(MAX_INGREDIENTS)).length, MAX_INGREDIENTS);
});

test("accepts valid ingredients", () => {
  for (const input of [
    "rice",
    "eggs and tomatoes",
    "chicken breast, garlic, basil",
    "eggs, rice, soy sauce",
  ]) {
    assert.equal(accepted(input), input);
  }
});

test("accepts valid dishes", () => {
  for (const input of ["jollof rice", "banku and tilapia", "waakye", "fufu with light soup", "shito"]) {
    assert.equal(accepted(input), input);
  }
});

test("accepts unfamiliar but plausible local dishes", () => {
  for (const input of ["nkatenkwan", "abolo and one-man-thousand", "tuo zaafi with ayoyo soup"]) {
    assert.equal(accepted(input), input);
  }
});

test("accepts non-Latin scripts so valid input is not lost", () => {
  for (const input of ["गेहूं और चावल", "米饭", "курица и рис"]) {
    assert.equal(accepted(input), input);
  }
});

test("two-letter input passes basic checks and is left to the AI", () => {
  // "hi" has no food meaning; the AI food-intent check rejects it. Basic
  // validation must not reject valid short words like "pho" or "naan".
  assert.equal(accepted("hi"), "hi");
  assert.equal(accepted("pho"), "pho");
  assert.equal(accepted("naan"), "naan");
});

test("trims surrounding whitespace", () => {
  assert.equal(accepted("  rice  "), "rice");
});

test("uses the exact required copy for non-food input", () => {
  assert.equal(
    NOT_FOOD_MESSAGE,
    "Hmm, we couldn't identify any food or ingredients in your input. 🍅 Please enter a food name, dish, or ingredients so we can help you create a delicious recipe!",
  );
});

test("uncertain and unavailable copy are distinct from the invalid copy", () => {
  assert.match(UNCERTAIN_MESSAGE, /not quite sure which food/);
  assert.match(UNAVAILABLE_MESSAGE, /temporarily unavailable/);
  assert.notEqual(UNCERTAIN_MESSAGE, NOT_FOOD_MESSAGE);
  assert.notEqual(UNAVAILABLE_MESSAGE, NOT_FOOD_MESSAGE);
});

test("empty input gets its own message so it is distinguishable", () => {
  assert.notEqual(EMPTY_MESSAGE, NOT_FOOD_MESSAGE);
});
