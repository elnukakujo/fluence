import { describe, expect, it } from "vitest";
import { DEFAULT_EXAM_CATEGORIES, getExamCategories, suggestCategory } from "./language_iso639";

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
    it("suggests a category only when the exam has it", () => {
        expect(suggestCategory("dictation", getExamCategories("jpn"))).toBe("listening");
        expect(suggestCategory("speaking", getExamCategories("jpn"))).toBeNull();
        expect(suggestCategory("speaking", DEFAULT_EXAM_CATEGORIES)).toBe("speaking");
        expect(suggestCategory("quizz", DEFAULT_EXAM_CATEGORIES)).toBeNull();
    });
});
