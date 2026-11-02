import { describe, expect, it } from "vitest";
import { itemCount, moveItem } from "./lessonOrder";

describe("moveItem", () => {
  it("moves an item down and up by one", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
  });
  it("returns the same order at the boundaries and does not mutate", () => {
    const items = ["a", "b"];
    expect(moveItem(items, 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(items, 1, 2)).toEqual(["a", "b"]);
    expect(items).toEqual(["a", "b"]);
  });
});

describe("itemCount", () => {
  it("sums the lesson's vocabulary, grammar, calligraphy and exercises", () => {
    expect(itemCount({ vocabulary: ["a", "b"], grammar: ["g"], calligraphy: [], exercise_ids: ["e1", "e2", "e3"] } as never)).toBe(6);
    expect(itemCount({} as never)).toBe(0);
  });
});
