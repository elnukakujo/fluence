import { describe, expect, it } from "vitest";
import { presetQuantities, scaled } from "./goalSplit";

describe("presetQuantities", () => {
    it("splits Standard over the three types like the server (4:1:2)", () => {
        expect(presetQuantities(15, 40, "week", ["vocabulary", "grammar", "calligraphy"])).toEqual({
            n: { vocabulary: 9, grammar: 2, calligraphy: 4 }, r: { vocabulary: 23, grammar: 6, calligraphy: 11 } });
    });
    it("scales to the period and leaves out a type the course does not study", () => {
        expect(scaled(15, "month")).toBe(64);
        expect(presetQuantities(5, 20, "week", ["vocabulary", "grammar"]).n).toEqual({ vocabulary: 4, grammar: 1 });
    });
});
