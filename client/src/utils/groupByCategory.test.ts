import { describe, expect, it } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { categoryLabel, groupByCategory, groupExercises } from "./groupByCategory";
import { getExamCategories } from "./language_iso639";

const ex = (id: string, exercise_type?: string) => ({ id, exercise_type }) as Exercise;
const shape = (gs: ReturnType<typeof groupByCategory>) => gs.map((g) => [g.slug, g.exercises.map((e) => e.id)]);

describe("groupByCategory", () => {
    it("follows the exam order (category derived from the type), then slugs the exam lacks, then uncategorized last; empty groups omitted", () => {
        const out = groupByCategory([ex("a"), ex("b", "dictation"), ex("c", "speaking"), ex("d", "answering"), ex("e", "poem"), ex("f", "dictation")], getExamCategories("jpn"));
        expect(shape(out)).toEqual([["reading", ["d"]], ["listening", ["b", "f"]], ["speaking", ["c"]], [null, ["a", "e"]]]);
    });
    it("empty list -> no groups", () => expect(groupByCategory([], getExamCategories("fra"))).toEqual([]));
    it("labels known slugs through i18n and falls back to the raw slug", () => {
        const t = (k: string) => `T(${k})`;
        expect(categoryLabel(t, "listening")).toBe("T(cat_listening)");
        expect(categoryLabel(t, "old-slug")).toBe("old-slug");
    });
});


describe("groupExercises", () => {
    const ex = (id: string, type: string, extra: Partial<Exercise> = {}) => ({ id, exercise_type: type, question: "", answer: "", ...extra }) as Exercise;
    const list = [ex("a", "essay", { generation_batch_id: "b1" }), ex("b", "quizz", { needs: ["audio"] }), ex("c", "essay")];

    it("by origin: AI-generated first, then added by hand", () => {
        expect(groupExercises(list, "origin", []).map((g) => [g.key, g.exercises.length])).toEqual([["ai", 1], ["manual", 2]]);
    });
    it("by status: ready before not ready", () => {
        expect(groupExercises(list, "status", []).map((g) => [g.key, g.exercises.length])).toEqual([["ready", 2], ["notready", 1]]);
    });
    it("by type: alphabetical, one group per type", () => {
        expect(groupExercises(list, "type", []).map((g) => [g.key, g.exercises.length])).toEqual([["essay", 2], ["quizz", 1]]);
    });
    it("by category falls back to the exam's order", () => {
        expect(groupExercises(list, "category", []).map((g) => g.exercises.length).reduce((a, b) => a + b)).toBe(3);
    });
});
