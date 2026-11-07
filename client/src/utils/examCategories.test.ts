import { describe, expect, it } from "vitest";
import { DEFAULT_EXAM_CATEGORIES, getExamCategories, categoryOf } from "./language_iso639";

const slugs = (iso?: string) => getExamCategories(iso).map((c) => c.slug);

describe("exam categories", () => {
    it("uses the language's exam sections", () => {
        expect(slugs("jpn")).toEqual(["language_knowledge", "reading", "listening"]);
        expect(slugs("zho")).toEqual(["listening", "reading", "writing"]);
        expect(slugs("fra")).toEqual(["listening", "reading", "writing", "speaking"]);
    });
    it("falls back to the four generic skills", () => {
        expect(getExamCategories("kor")).toBe(DEFAULT_EXAM_CATEGORIES);
        expect(slugs(undefined)).toEqual(["listening", "reading", "writing", "speaking"]);
    });
    it("derives the category from the type, for all 13 types", () => {
        const types = ["essay", "answering", "translate", "speaking", "conversation", "organize", "type_in_the_blank", "select_in_the_blank", "matching", "true_false", "quizz", "reading", "dictation"];
        for (const t of types) expect(categoryOf(t, getExamCategories("jpn"))).not.toBeNull();
        const jpn = getExamCategories("jpn"), fra = getExamCategories("fra");
        expect([categoryOf("dictation", jpn), categoryOf("reading", jpn), categoryOf("answering", jpn)]).toEqual(["listening", "reading", "reading"]);
        expect([categoryOf("speaking", fra), categoryOf("conversation", fra), categoryOf("essay", fra), categoryOf("translate", fra)]).toEqual(["speaking", "speaking", "writing", "writing"]);
        for (const t of ["quizz", "matching", "true_false", "organize", "type_in_the_blank", "select_in_the_blank"]) {
            expect(categoryOf(t, jpn)).toBe("language_knowledge");
            expect(categoryOf(t, fra)).toBe("reading");
        }
        expect(categoryOf("nope", jpn)).toBeNull();
    });
});
