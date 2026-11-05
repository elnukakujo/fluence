import { describe, expect, it } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { selectPracticeExercises } from "./practice";

const ex = (id: string, over: Partial<Exercise> = {}) => ({ id, question: "q", answer: "a", ...over }) as Exercise;
const ids = (xs: Exercise[]) => xs.map((x) => x.id);

describe("selectPracticeExercises", () => {
    it("drops banned and not-ready exercises", () => {
        const out = selectPracticeExercises([ex("a"), ex("b", { banned: true }), ex("c", { needs: ["audio"] })]);
        expect(ids(out)).toEqual(["a"]);
    });
    it("puts boosted exercises first, the rest shuffled", () => {
        const list = [ex("a"), ex("b"), ex("c", { boosted: true }), ex("d")];
        const out = selectPracticeExercises(list, () => 0.5);   // constant rng: sort is stable
        expect(ids(out)).toEqual(["c", "a", "b", "d"]);
    });
    it("empty in, empty out", () => expect(selectPracticeExercises([])).toEqual([]));
});
