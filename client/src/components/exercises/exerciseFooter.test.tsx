// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateScoreById = vi.fn().mockResolvedValue(undefined);
vi.mock("@/api/process", () => ({ updateScoreById: (...a: unknown[]) => updateScoreById(...a) }));

import ExerciseFooter from "./exerciseFooter";
import type Exercise from "@/interface/features/Exercise";

const ex = { id: "ex_1", exercise_type: "essay", question: "q", answer: "a" } as Exercise;
const base = { exercise: ex, onGiveUp: vi.fn(), onSkip: vi.fn(), onNext: vi.fn() };

beforeEach(() => { vi.clearAllMocks(); });

describe("ExerciseFooter", () => {
    it("shows the skip buttons and no Next while running", () => {
        render(<ExerciseFooter {...base} finished={false} isLast={false} />);
        expect(screen.getByRole("button", { name: "I don't know" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next Exercise" })).toBeNull();
    });

    it("shows only a full-width Next when finished", () => {
        render(<ExerciseFooter {...base} finished isLast={false} />);
        expect(screen.queryByRole("button", { name: "I don't know" })).toBeNull();
        const next = screen.getByRole("button", { name: "Next Exercise" });
        expect(next).toHaveClass("w-full");
        fireEvent.click(next);
        expect(base.onNext).toHaveBeenCalledTimes(1);
    });

    it("renders the last slot instead of Next on the last exercise", () => {
        render(<ExerciseFooter {...base} finished isLast last={<a>done</a>} />);
        expect(screen.getByText("done")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next Exercise" })).toBeNull();
    });

    it("I don't know records a 0 and gives up instead of advancing", () => {
        render(<ExerciseFooter {...base} finished={false} isLast={false} />);
        fireEvent.click(screen.getByRole("button", { name: "I don't know" }));
        expect(updateScoreById).toHaveBeenCalledWith("ex_1", 0, expect.any(Number), false, 1);
        expect(base.onGiveUp).toHaveBeenCalledTimes(1);
        expect(base.onNext).not.toHaveBeenCalled();
    });
});
