import { describe, expect, it } from "vitest";
import { scaleMix } from "./scaleMix";

const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

describe("scaleMix", () => {
    const base = { essay: 6, quizz: 4, matching: 2 };
    it("always adds up to the asked count", () => {
        for (const n of [1, 2, 5, 12, 30, 60]) expect(total(scaleMix(base, n))).toBe(n);
    });
    it("one exercise is one type, the most wanted", () => expect(scaleMix(base, 1)).toEqual({ essay: 1 }));
    it("keeps the proportions", () => expect(scaleMix(base, 24)).toEqual({ essay: 12, quizz: 8, matching: 4 }));
    it("no types, or a count below one, gives nothing", () => {
        expect(scaleMix({}, 5)).toEqual({});
        expect(scaleMix(base, 0)).toEqual({});
    });
});
