import { describe, expect, it } from "vitest";
import { elementKindOf } from "./elementKinds";

describe("elementKindOf", () => {
    it.each([
        ["lang_1", "language"], ["lesson_1", "lesson"], ["voc_1", "vocabulary"], ["gram_1", "grammar"],
        ["call_1", "calligraphy"], ["ex_1", "exercise"], ["char_1", "character"], ["word_1", "word"],
        ["pass_1", "passage"], ["tag_1", "tag"], ["src_1", "source"],
    ])("%s -> %s", (id, kind) => {
        expect(elementKindOf(id)?.kind).toBe(kind);
    });

    it("is case-insensitive", () => {
        expect(elementKindOf("VOC_1")?.kind).toBe("vocabulary");
        expect(elementKindOf("LANG_1")?.kind).toBe("language");
    });

    it("has a deleter for deletable kinds only", () => {
        expect(elementKindOf("voc_1")?.deleter).toBeDefined();
        expect(elementKindOf("lang_1")?.deleter).toBeDefined();
        expect(elementKindOf("char_1")?.deleter).toBeUndefined();
        expect(elementKindOf("word_1")?.deleter).toBeUndefined();
        expect(elementKindOf("pass_1")?.deleter).toBeUndefined();
    });

    it("returns undefined for unknown or empty", () => {
        expect(elementKindOf("zzz_1")).toBeUndefined();
        expect(elementKindOf("")).toBeUndefined();
    });
});
