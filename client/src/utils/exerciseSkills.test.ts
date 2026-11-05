import { describe, expect, it } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { applySkips, needsHearing, needsSpeaking } from "./exerciseSkills";

const ex = (id: string, exercise_type: Exercise["exercise_type"], audio_files: string[] = []) => ({ id, exercise_type, audio_files }) as Exercise;

describe("exercise skips", () => {
    it("classifies hearing and speaking exercises", () => {
        expect(needsHearing(ex("a", "dictation"))).toBe(true);
        expect(needsHearing(ex("a", "answering", ["x.wav"]))).toBe(true);
        expect(needsHearing(ex("a", "answering"))).toBe(false);
        expect(needsHearing(ex("a", "reading", ["x.wav"]))).toBe(false);   // optional Play button
        expect(needsSpeaking(ex("a", "speaking"))).toBe(true);
        expect(needsSpeaking(ex("a", "conversation"))).toBe(true);
        expect(needsSpeaking(ex("a", "essay"))).toBe(false);
    });
    it("splits kept and skipped, keeping order", () => {
        const list = [ex("1", "essay"), ex("2", "dictation"), ex("3", "speaking"), ex("4", "quizz")];
        const only = (s: { hear: boolean; speak: boolean }) => applySkips(list, s);
        expect(only({ hear: true, speak: false }).skipped.map((e) => e.id)).toEqual(["2"]);
        expect(only({ hear: true, speak: true }).kept.map((e) => e.id)).toEqual(["1", "4"]);
        expect(only({ hear: false, speak: false }).kept).toHaveLength(4);
    });
});
