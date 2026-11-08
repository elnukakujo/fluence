import { describe, expect, it } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { pickReplacement } from "./replaceCard";

const ex = (id: string, exercise_type: string) => ({ id, exercise_type }) as unknown as Exercise;

describe("pickReplacement", () => {
  const spares = [ex("a", "dictation"), ex("b", "speaking"), ex("c", "translate"), ex("d", "essay")];
  it("takes the first spare the learner can do", () => {
    expect(pickReplacement(spares, "hearing", new Set())?.id).toBe("b");
    expect(pickReplacement(spares, "speaking", new Set())?.id).toBe("a");
    expect(pickReplacement(spares, null, new Set())?.id).toBe("a");
  });
  it("skips used spares and returns undefined when none fits", () => {
    expect(pickReplacement(spares, "hearing", new Set(["b", "c"]))?.id).toBe("d");
    expect(pickReplacement([ex("a", "dictation")], "hearing", new Set())).toBeUndefined();
  });
});
