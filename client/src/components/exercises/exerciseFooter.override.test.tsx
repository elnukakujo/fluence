// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
