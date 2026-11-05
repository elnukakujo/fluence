import { describe, expect, it } from "vitest";
import { SIDE_PRESETS, parseCycle, presetKeyOf, ratioPattern } from "./sidePattern";

describe("sidePattern", () => {
    it("recognises presets and defaults", () => {
        expect(presetKeyOf(null)).toBe("random");
        expect(presetKeyOf({ mode: "cycle", cycle: ["F", "F", "B"] })).toBe("twoFrontOneBack");
        expect(presetKeyOf({ mode: "random", front: 3, back: 1 })).toBe("custom");
        expect(presetKeyOf(SIDE_PRESETS.split)).toBe("split");
    });
    it("parses cycles", () => {
        expect(parseCycle("ffb")).toEqual(["F", "F", "B"]);
        expect(parseCycle("F, B")).toEqual(["F", "B"]);
        expect(parseCycle("FXB")).toBeNull();
        expect(parseCycle("")).toBeNull();
    });
    it("validates ratios", () => {
        expect(ratioPattern(3, 1)).toEqual({ mode: "random", front: 3, back: 1 });
        expect(ratioPattern(0, 0)).toBeNull();
        expect(ratioPattern(-1, 2)).toBeNull();
        expect(ratioPattern(1.5, 2)).toBeNull();
    });
});
