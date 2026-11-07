import { describe, expect, it } from "vitest";
import { HINT_CAPS, contextHint, shapeHint, suggestedGrade } from "./cardHints";

describe("shapeHint", () => {
    it("gives the first character and one blank per remaining character", () => {
        expect(shapeHint("cat")).toBe("c _ _");
        expect(shapeHint("你好")).toBe("你 _");
        expect(shapeHint("a")).toBe("a");
        expect(shapeHint("  ")).toBe("");
    });
    it("ignores spaces inside the answer", () => expect(shapeHint("ice cream")).toBe("i _ _ _ _ _ _ _"));
});

describe("contextHint", () => {
    const sentence = { text: "猫在睡觉", translation: "The cat sleeps." };
    it("when the answer is the translation, the example is shown as written", () => expect(contextHint(sentence, "猫", "translation")).toBe("猫在睡觉"));
    it("when the answer is the word, it is blanked in the sentence next to the sentence's translation", () => {
        expect(contextHint(sentence, "猫", "word")).toBe("___在睡觉 — The cat sleeps.");
        expect(contextHint({ text: "abc", translation: "t" }, "猫", "word")).toBe("abc — t");
    });
    it("no example, no hint", () => {
        expect(contextHint(undefined, "猫", "word")).toBeNull();
        expect(contextHint({ translation: "x" }, "猫", "translation")).toBeNull();
    });
});

describe("grade caps and suggestion", () => {
    it("each hint level caps the best grade", () => expect(HINT_CAPS).toEqual([1, 0.75, 0.5]));
    it("suggests from hints first, then from the time taken", () => {
        expect(suggestedGrade(500, 2)).toBe("hard");
        expect(suggestedGrade(500, 1)).toBe("good");
        expect(suggestedGrade(2999, 0)).toBe("easy");
        expect(suggestedGrade(3000, 0)).toBe("good");
        expect(suggestedGrade(9999, 0)).toBe("good");
        expect(suggestedGrade(10000, 0)).toBe("hard");
    });
});
