import { describe, expect, it } from "vitest";
import { gradeForTyped, matchesAnswer } from "./typedAnswer";

describe("matchesAnswer", () => {
    it("ignores case, spaces and punctuation, including full-width", () => {
        expect(matchesAnswer("  你好！ ", { word: "你好" })).toBe(true);
        expect(matchesAnswer("Chat", { word: "chat" })).toBe(true);
        expect(matchesAnswer("Ça va ?", { word: "ça va" })).toBe(true);
    });
    it("accepts the phonetic without tone marks or tone digits", () => {
        expect(matchesAnswer("ni hao", { word: "你好", phonetic: "nǐ hǎo" })).toBe(true);
        expect(matchesAnswer("ni3 hao3", { word: "你好", phonetic: "nǐ hǎo" })).toBe(true);
        expect(matchesAnswer("nǐ hǎo", { word: "你好", phonetic: "nǐ hǎo" })).toBe(true);
    });
    it("rejects a different answer and an empty one", () => {
        expect(matchesAnswer("chien", { word: "chat" })).toBe(false);
        expect(matchesAnswer("   ", { word: "chat" })).toBe(false);
        expect(matchesAnswer("", { word: "", phonetic: "" })).toBe(false);
    });
});

describe("gradeForTyped", () => {
    it("wrong is 0, a slow right answer is good, a fast one is easy", () => {
        expect(gradeForTyped(false, 500)).toBe(0);
        expect(gradeForTyped(true, 2999)).toBe(1);
        expect(gradeForTyped(true, 3000)).toBe(0.75);
    });
});
