// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { updateScoreById } from "@/api/process";
import { useAttemptScoring } from "./useAttemptScoring";

vi.mock("@/api/process", () => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));

const ex = { id: "ex1" } as Exercise;
const calls = () => vi.mocked(updateScoreById).mock.calls;

beforeEach(() => vi.mocked(updateScoreById).mockClear());

describe("useAttemptScoring", () => {
    it("posts wrong then right with attempt 1 then 2", () => {
        const { result } = renderHook(() => useAttemptScoring(ex));
        act(() => result.current.submit(0));
        act(() => result.current.submit(1));
        expect(calls()).toEqual([
            ["ex1", expect.objectContaining({ similarity: 0, hintUsed: false, attempt: 1, skill: "recall" })],
            ["ex1", expect.objectContaining({ similarity: 1, hintUsed: false, attempt: 2, skill: "recall" })],
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
        act(() => result.current.submit(0));
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
});
