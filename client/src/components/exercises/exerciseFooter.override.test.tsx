// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scoreExercise = vi.fn().mockResolvedValue({});
const overrideExercise = vi.fn().mockResolvedValue({ credited: true });
vi.mock("@/api/process", () => ({ scoreExercise: (...a: unknown[]) => scoreExercise(...a), overrideExercise: (...a: unknown[]) => overrideExercise(...a) }));

import ExerciseFooter from "./exerciseFooter";
import { creditExercise, forgetAttempt } from "./creditExercise";
import type Exercise from "@/interface/features/Exercise";

const ex = { id: "ex_1", exercise_type: "translate", question: "q", answer: "a" } as Exercise;
const props = { exercise: ex, finished: true, isLast: false, onGiveUp: vi.fn(), onSkip: vi.fn(), onNext: vi.fn() };

beforeEach(() => { vi.clearAllMocks(); forgetAttempt(); });

describe("I was right", () => {
    it("is offered after a wrong final attempt and posts the override once", () => {
        creditExercise(ex, 0, 10, false, 1);
        render(<ExerciseFooter {...props} />);
        fireEvent.click(screen.getByRole("button", { name: "I was right" }));
        expect(overrideExercise).toHaveBeenCalledTimes(1);
        expect(overrideExercise.mock.calls[0][0]).toBe("ex_1");
        expect(overrideExercise.mock.calls[0][1]).toMatchObject({ attempt: 1 });
        expect(screen.queryByRole("button", { name: "I was right" })).toBeNull();
    });

    it("sits on the same row as Next, in the pinned bar and out of it", () => {
        for (const pinned of [false, true]) {
            creditExercise(ex, 0, 10, false, 1);
            const { unmount } = render(<ExerciseFooter {...props} pinned={pinned} />);
            const right = screen.getByRole("button", { name: "I was right" });
            const next = screen.getByRole("button", { name: "Next Exercise" });
            expect(right.parentElement).toBe(next.parentElement);
            expect(right.parentElement).toHaveClass("flex", "items-center");
            expect(right.parentElement).not.toHaveClass("flex-col");
            unmount();
            forgetAttempt();
        }
    });

    it("shows what the answer did to the scores in the bar's strip, once the server answers", async () => {
        scoreExercise.mockResolvedValueOnce({ correct: 1, total: 2, summary: { before: 10, after: 30, level: "learning", level_up: false } });
        creditExercise(ex, 0.5, 10, false, 1);
        render(<ExerciseFooter {...props} pinned />);
        await waitFor(() => expect(screen.getByTestId("result-strip")).toHaveTextContent("+20 pointsCard score 10 → 30 · Learning"));
    });

    it("shows nothing but the saved note when the server sent no summary", async () => {
        creditExercise(ex, 0.5, 10, false, 1);
        render(<ExerciseFooter {...props} pinned />);
        await waitFor(() => expect(scoreExercise).toHaveBeenCalled());
        expect(screen.getByTestId("result-strip")).not.toHaveTextContent("points");
    });

    it("is not offered after a right attempt or a give-up", () => {
        creditExercise(ex, 1, 10, false, 1);
        const { unmount } = render(<ExerciseFooter {...props} />);
        expect(screen.queryByRole("button", { name: "I was right" })).toBeNull();
        unmount();
        creditExercise(ex, 0, 10, false, 1);
        forgetAttempt();
        render(<ExerciseFooter {...props} />);
        expect(screen.queryByRole("button", { name: "I was right" })).toBeNull();
    });
});
