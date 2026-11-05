import { describe, expect, it } from "vitest";
import { joinPattern, splitPattern } from "./sidePattern";

describe("sidePattern", () => {
    it("splits stored patterns into ratio and order", () => {
        expect(splitPattern(null)).toEqual({ front: 1, back: 1, order: "random" });
        expect(splitPattern({ mode: "random", front: 3, back: 1 })).toEqual({ front: 3, back: 1, order: "random" });
        expect(splitPattern({ mode: "cycle", cycle: ["F", "F", "B"] })).toEqual({ front: 2, back: 1, order: "alternate" });
        expect(splitPattern({ mode: "split" }).order).toBe("blocks");
    });
    it("joins ratio and order back", () => {
        expect(joinPattern({ front: 3, back: 1, order: "random" })).toEqual({ mode: "random", front: 3, back: 1 });
        expect(joinPattern({ front: 2, back: 1, order: "alternate" })).toEqual({ mode: "cycle", cycle: ["F", "F", "B"] });
        expect(joinPattern({ front: 0, back: 0, order: "blocks" })).toEqual({ mode: "split" });
    });
    it("rejects an invalid ratio", () => {
        expect(joinPattern({ front: 0, back: 0, order: "random" })).toBeNull();
        expect(joinPattern({ front: 1.5, back: 2, order: "alternate" })).toBeNull();
    });
});
