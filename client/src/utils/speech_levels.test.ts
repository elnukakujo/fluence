import { describe, expect, it } from "vitest";
import { getExerciseLevel } from "./speech_levels";

const STARS = ["☆☆☆☆☆", "★☆☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"];
const T = ((key: string) => key) as (key: string) => string;

const CASES: [string, number[]][] = [
    ["speaking", [0, 0.5, 0.7, 0.85, 0.95]],
    ["type_in_the_blank", [0, 0.5, 0.7, 0.85, 0.95]],
    ["organize", [0, 0.45, 0.65, 0.8, 0.92]],
    ["translate", [0, 0.4, 0.6, 0.78, 0.9]],
    ["answering", [0, 0.35, 0.55, 0.72, 0.88]],
    ["conversation", [0, 0.3, 0.5, 0.68, 0.85]],
    ["essay", [0, 0.25, 0.45, 0.65, 0.82]],
];

describe("getExerciseLevel", () => {
    it.each(CASES)("%s threshold boundaries map to the same stars", (type, thresholds) => {
        thresholds.forEach((t, n) => {
            expect(getExerciseLevel(type, t, T).stars).toBe(STARS[n]);
        });
        expect(getExerciseLevel(type, 1.0, T).stars).toBe(STARS[4]);
    });

    it("labels and descriptions come from i18n keys", () => {
        expect(getExerciseLevel("speaking", 0.95, T).label).toBe("levels.speaking.4.label");
        expect(getExerciseLevel("speaking", 0.95, T).description).toBe("levels.speaking.4.description");
    });

    it("unknown type falls back to translate", () => {
        expect(getExerciseLevel("dictation", 0.9, T).stars).toBe(STARS[4]);
    });
});
