import { describe, expect, it } from "vitest";
import { STUDY } from "@/shared/studyConstants";
import { speakingLabel } from "./speakingLabel";

const { offset, excellentFrom, goodFrom } = STUDY.speaking;

describe("speakingLabel", () => {
    it("the bar is the similarity minus 0.15, kept in 0..1", () => {
        expect(offset).toBe(0.15);
        expect(speakingLabel(0.9).barValue).toBeCloseTo(0.75);
        expect(speakingLabel(0.1).barValue).toBe(0);
        expect(speakingLabel(1).barValue).toBeCloseTo(0.85);
        expect(speakingLabel(2).barValue).toBe(1);
    });
    it("the label is read off the bar, with the boundary on the higher label", () => {
        expect(speakingLabel(excellentFrom + offset).label).toBe("excellent");
        expect(speakingLabel(excellentFrom + offset - 0.01).label).toBe("good");
        expect(speakingLabel(goodFrom + offset).label).toBe("good");
        expect(speakingLabel(goodFrom + offset - 0.01).label).toBe("keepGoing");
        expect(speakingLabel(0).label).toBe("keepGoing");
    });
});
