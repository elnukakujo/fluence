import { describe, expect, it } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { categoryLabel, groupByCategory } from "./groupByCategory";
import { getExamCategories } from "./language_iso639";

const ex = (id: string, category?: string | null) => ({ id, category }) as Exercise;
const shape = (gs: ReturnType<typeof groupByCategory>) => gs.map((g) => [g.slug, g.exercises.map((e) => e.id)]);

describe("groupByCategory", () => {
    it("follows the exam order, then stale slugs, then uncategorized last; empty groups omitted", () => {
        const out = groupByCategory([ex("a"), ex("b", "listening"), ex("c", "old-slug"), ex("d", "reading"), ex("e", null), ex("f", "listening")], getExamCategories("jpn"));
        expect(shape(out)).toEqual([["reading", ["d"]], ["listening", ["b", "f"]], ["old-slug", ["c"]], [null, ["a", "e"]]]);
    });
    it("empty list -> no groups", () => expect(groupByCategory([], getExamCategories("fra"))).toEqual([]));
    it("labels known slugs through i18n and falls back to the raw slug", () => {
        const t = (k: string) => `T(${k})`;
        expect(categoryLabel(t, "listening")).toBe("T(cat_listening)");
        expect(categoryLabel(t, "old-slug")).toBe("old-slug");
    });
});
