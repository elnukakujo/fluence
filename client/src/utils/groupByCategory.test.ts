import { describe, expect, it } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { categoryLabel, groupByCategory } from "./groupByCategory";
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
