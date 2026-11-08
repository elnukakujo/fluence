import { describe, expect, it } from "vitest";
import { addable, free, placed, resize, step } from "./mixEdit";

describe("mixEdit", () => {
  const mix = { translate: 4, quizz: 2 };

  it("counts what is placed and what is free", () => {
    expect(placed(mix)).toBe(6);
    expect(free(mix, 7)).toBe(1);
    expect(free(mix, 6)).toBe(0);
  });

  it("refuses + when nothing is free, allows it after a −", () => {
    expect(step(mix, "quizz", 1, 6)).toEqual(mix);
    const less = step(mix, "translate", -1, 6);
    expect(less).toEqual({ translate: 3, quizz: 2 });
    expect(step(less, "dictation", 1, 6)).toEqual({ translate: 3, quizz: 2, dictation: 1 });
  });

  it("− at 1 removes the row and the type can be added again", () => {
    const one = step({ translate: 5, dictation: 1 }, "dictation", -1, 6);
    expect(one).toEqual({ translate: 5 });
    expect(addable(["translate", "dictation", "essay"], one)).toEqual(["dictation", "essay"]);
  });

  it("− never goes below 0 on a missing type", () => {
    expect(step(mix, "essay", -1, 6)).toEqual(mix);
  });

  it("resize keeps the edited proportions and sums to the new total", () => {
    const out = resize({ translate: 8, dictation: 1, quizz: 3 }, 6);
    expect(placed(out)).toBe(6);
    expect(Object.values(out).every((n) => n > 0)).toBe(true);
    expect(out.translate).toBeGreaterThan(out.quizz);
    expect(resize({}, 5)).toEqual({});
    expect(placed(resize(mix, 1))).toBe(1);
  });
});
