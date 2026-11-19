// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { scoreExercise } from "@/api/process";
import { useAttemptScoring } from "./useAttemptScoring";

vi.mock("@/api/process", () => ({ scoreExercise: vi.fn().mockResolvedValue({}) }));

const ex = { id: "ex1" } as Exercise;
const calls = () => vi.mocked(scoreExercise).mock.calls;

beforeEach(() => vi.mocked(scoreExercise).mockClear());

describe("useAttemptScoring", () => {
    it("a non-final wrong posts nothing; the right attempt posts once, as attempt 2", () => {
        const { result } = renderHook(() => useAttemptScoring(ex));
        act(() => result.current.submit(0));
        expect(calls()).toHaveLength(0);
        act(() => result.current.submit(1));
        expect(calls()).toEqual([
            ["ex1", expect.objectContaining({ final: true, hintUsed: false, attempt: 2, results: [expect.objectContaining({ quality: 1, skill: "recall" })] })],
        ]);
        expect(result.current.finished).toBe(true);
        expect(result.current.correct).toBe(true);
    });

    it("ignores a second submit after finishing", () => {
        const { result } = renderHook(() => useAttemptScoring(ex));
        act(() => result.current.submit(1));
        act(() => result.current.submit(0));
        expect(calls()).toHaveLength(1);
    });

    it("miss advances attempts without posting or finishing", () => {
        const { result } = renderHook(() => useAttemptScoring(ex));
        act(() => result.current.miss());
        act(() => result.current.miss());
        expect(result.current.attempts).toBe(2);
        expect(result.current.finished).toBe(false);
        expect(calls()).toHaveLength(0);
    });

    it("reset clears attempts and the double-submit guard", () => {
        const { result } = renderHook(() => useAttemptScoring(ex));
        act(() => result.current.submit(1));
        act(() => result.current.reset());
        expect(result.current.finished).toBe(false);
        act(() => result.current.submit(1));
        expect(calls()).toHaveLength(2); // the first post + the post after reset
    });

    it("changing exercise resets attempts", () => {
        const ex1 = { id: "ex1" } as Exercise;
        const ex2 = { id: "ex2" } as Exercise;
        const { result, rerender } = renderHook(({ e }) => useAttemptScoring(e), { initialProps: { e: ex1 } });
        act(() => result.current.miss());
        expect(result.current.attempts).toBe(1);
        rerender({ e: ex2 });
        expect(result.current.attempts).toBe(0);
    });

    it("each blank credits the element it tests; an untested linked element gets the exercise quality", () => {
        const linked = { id: "ex1", exercise_type: "type_in_the_blank", related_vocabulary: ["voc_1", "voc_2"], related_grammar: ["gram_1"],
            content: { segments: ["a", "b", "c"], blanks: [{ answer: "x", element_id: "voc_1" }, { answer: "y", element_id: "voc_2" }] } } as unknown as Exercise;
        const { result } = renderHook(() => useAttemptScoring(linked));
        act(() => result.current.submit(0.5, { final: true, parts: [1, 0] }));
        expect(calls()).toHaveLength(1);
        expect(calls()[0][1].results).toEqual([
            { element_id: "voc_1", quality: 1, skill: "recall", evidence_type: "typed" },   // a typed blank recalls: a vocabulary takes the skill of the exercise type (RD-126)
            { element_id: "voc_2", quality: 0, skill: "recall", evidence_type: "typed" },
            { element_id: "gram_1", quality: 0.5, skill: "recognition", evidence_type: "typed" },
        ]);
    });
});
