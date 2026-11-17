import { describe, expect, it } from "vitest";
import { evidenceFor, exerciseResults, skillFor } from "./skills";
import type Exercise from "@/interface/features/Exercise";

describe("skillFor", () => {
    it("a vocabulary face picks the skill", () => {
        expect(skillFor("voc_1", "front")).toBe("recognition");
        expect(skillFor("voc_1", "back")).toBe("recall");
        expect(skillFor("voc_1")).toBe("recognition");
    });
    it("a listen or speak card overrides the face", () => {
        expect(skillFor("voc_1", "back", "listen")).toBe("recognition");
        expect(skillFor("voc_1", "front", "speak")).toBe("recall");
    });
    it("other kinds have one skill", () => {
        expect(skillFor("gram_1")).toBe("recognition");
        expect(skillFor("call_1")).toBe("recall");
        expect(skillFor("ex_1")).toBe("recall");
    });
});

describe("evidenceFor", () => {
    it("maps the exercise type to how it was answered", () => {
        expect(evidenceFor("quizz")).toBe("multiple_choice");
        expect(evidenceFor("matching")).toBe("matching");
        expect(evidenceFor("speaking")).toBe("spoken");
        expect(evidenceFor("dictation")).toBe("typed");
        expect(evidenceFor("reading")).toBe("self_grade");
    });
});

describe("exerciseResults", () => {
    const matching = { id: "ex_1", exercise_type: "matching", related_vocabulary: ["voc_1", "voc_2"],
        content: { pairs: [["a", "b"], ["c", "d"], ["e", "f"]], element_ids: ["voc_1", "voc_1", null] } } as unknown as Exercise;
    it("a pair credits the element it tests (two pairs on one element stay two parts); unlinked pairs credit nobody", () => {
        expect(exerciseResults(matching, 0.7, [1, 0, 1]).map((r) => [r.element_id, r.quality, r.evidence_type])).toEqual([
            ["voc_1", 1, "matching"], ["voc_1", 0, "matching"], ["voc_2", 0.7, "matching"]]);
    });
    it("ignores a part whose element is not linked, and an exercise with nothing linked credits itself", () => {
        const stray = { ...matching, related_vocabulary: ["voc_2"] } as Exercise;
        expect(exerciseResults(stray, 0.4, [1, 1, 1]).map((r) => r.element_id)).toEqual(["voc_2"]);
        expect(exerciseResults({ id: "ex_9", exercise_type: "essay" } as Exercise, 0.8).map((r) => [r.element_id, r.skill])).toEqual([["ex_9", "recall"]]);
    });
});
