import { describe, expect, it } from "vitest";
import { evidenceFor, skillFor } from "./skills";

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
