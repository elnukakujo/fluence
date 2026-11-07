import { describe, expect, it } from "vitest";
import { cardTier, scaffoldsFor, tierOf } from "./cardTier";

describe("cardTier", () => {
    it("a low score or a high difficulty is learning", () => {
        expect(cardTier(0, 0.5)).toBe("learning");
        expect(cardTier(19.9, 0.2)).toBe("learning");
        expect(cardTier(30, 0.9)).toBe("learning");
        expect(cardTier(60, 0.71)).toBe("learning");
    });
    it("in between is practising", () => {
        expect(cardTier(20, 0.5)).toBe("practising");
        expect(cardTier(59.9, 0.3)).toBe("practising");
    });
    it("mastered and easy is maintaining", () => {
        expect(cardTier(60, 0.7)).toBe("maintaining");
        expect(cardTier(95, 0.1)).toBe("maintaining");
    });
});

describe("tierOf", () => {
    it("a card without scores is learning", () => expect(tierOf({})).toBe("learning"));
    it("a vocabulary card uses its own side's score and difficulty", () => {
        const card = { front_score: 80, front_difficulty: 0.3, back_score: 5, back_difficulty: 0.5, score: 40, difficulty: 0.4 };
        expect(tierOf({ ...card, side: "front" })).toBe("maintaining");
        expect(tierOf({ ...card, side: "back" })).toBe("learning");
    });
    it("other cards use the element's score and difficulty", () => expect(tierOf({ score: 40, difficulty: 0.4 })).toBe("practising"));
});

describe("scaffoldsFor", () => {
    it("fades from shown to peek to hidden", () => {
        expect(scaffoldsFor("learning")).toEqual({ detail: "shown", example: true });
        expect(scaffoldsFor("practising")).toEqual({ detail: "peek", example: false });
        expect(scaffoldsFor("maintaining")).toEqual({ detail: "hidden", example: false });
    });
});
