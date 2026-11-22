import { describe, expect, it } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { needsHearing, needsSpeaking } from "./exerciseSkills";

const ex = (id: string, exercise_type: Exercise["exercise_type"], audio_files: string[] = []) => ({ id, exercise_type, audio_files }) as Exercise;

describe("exercise skips", () => {
    it("classifies hearing and speaking exercises", () => {
        expect(needsHearing(ex("a", "dictation"))).toBe(true);
        expect(needsHearing(ex("a", "answering", ["x.wav"]))).toBe(true);
        expect(needsHearing(ex("a", "answering"))).toBe(false);
        expect(needsHearing(ex("a", "reading", ["x.wav"]))).toBe(false);   // optional Play button
        for (const type of ["true_false", "quizz", "speaking", "conversation", "select_in_the_blank"] as const) expect(needsHearing(ex("a", type, ["x.wav"]))).toBe(true);   // any audio, not the type
        expect(needsHearing(ex("a", "true_false"))).toBe(false);
        expect(needsSpeaking(ex("a", "speaking"))).toBe(true);
        expect(needsSpeaking(ex("a", "conversation"))).toBe(true);
        expect(needsSpeaking(ex("a", "essay"))).toBe(false);
    });
});
