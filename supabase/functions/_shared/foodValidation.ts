/**
 * Deterministic input checks shared by the Vite frontend and the Supabase edge
 * function, so the client and the server can never disagree about what counts
 * as an acceptable submission and the user-facing copy lives in one place.
 *
 * This module must stay dependency-free: it is imported by both a browser
 * bundle and a Deno edge function.
 */

export const MAX_INGREDIENTS = 1000;

/** Letters required before it is worth asking the AI at all. */
const MIN_LETTERS = 2;

export const NOT_FOOD_MESSAGE =
  "Hmm, we couldn't identify any food or ingredients in your input. \u{1F345} Please enter a food name, dish, or ingredients so we can help you create a delicious recipe!";

export const UNCERTAIN_MESSAGE =
  "We're not quite sure which food you mean. Could you check the spelling or tell us a little more about the dish or ingredients?";

export const UNAVAILABLE_MESSAGE =
  "Recipe validation is temporarily unavailable. Please try again in a moment.";

export const EMPTY_MESSAGE = "Please enter a food name or some ingredients first.";

export const TOO_LONG_MESSAGE = `That is a bit long. Please keep it under ${MAX_INGREDIENTS} characters.`;

export type InputProblem = "empty" | "too_long" | "no_letters";

export type InputCheck =
  | { ok: true; value: string }
  | { ok: false; problem: InputProblem; message: string };

/**
 * Counts letters in any script, so "jollof rice", "banku and tilapia" and
 * non-Latin input all pass, while "@@@", "!!!", "12345" and "x" do not.
 */
const countLetters = (text: string) => (text.match(/\p{L}/gu) ?? []).length;

/**
 * Rejects the cases that never need an AI call: empty, whitespace-only,
 * symbol/digit-only, and over-long input. Everything else is passed through to
 * the AI food-intent check in the edge function.
 */
export function checkFoodInput(raw: unknown): InputCheck {
  if (typeof raw !== "string") {
    return { ok: false, problem: "empty", message: EMPTY_MESSAGE };
  }

  const value = raw.trim();

  if (!value) {
    return { ok: false, problem: "empty", message: EMPTY_MESSAGE };
  }

  if (value.length > MAX_INGREDIENTS) {
    return { ok: false, problem: "too_long", message: TOO_LONG_MESSAGE };
  }

  if (countLetters(value) < MIN_LETTERS) {
    return { ok: false, problem: "no_letters", message: NOT_FOOD_MESSAGE };
  }

  return { ok: true, value };
}
