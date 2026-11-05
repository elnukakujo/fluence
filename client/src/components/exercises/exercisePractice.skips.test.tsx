// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";

vi.mock("./exerciseRunner", () => ({ default: ({ exercise }: { exercise: Exercise }) => <div data-testid="runner">{exercise.id}</div> }));
vi.mock("@/components/ui/buttons/backButton", () => ({ default: ({ children }: { children: React.ReactNode }) => <button>{children}</button> }));

import ExercisePractice from "./exercisePractice";

const ex = (id: string, exercise_type: Exercise["exercise_type"], audio_files: string[] = []) => ({ id, exercise_type, audio_files, question: "q", answer: "a" }) as Exercise;
const current = () => screen.queryByTestId("runner")?.textContent;

describe("practice skips", () => {
    it("shows no skip button on an exercise that needs neither hearing nor speaking", () => {
        render(<ExercisePractice exercise_lists={[ex("e1", "essay"), ex("e2", "dictation")]} />);
        expect(screen.queryByRole("button", { name: /I can't/ })).toBeNull();
    });

    it("can't hear shows only on audio exercises and skips just that one, unscored", async () => {
        render(<ExercisePractice exercise_lists={[ex("e1", "dictation"), ex("e2", "answering", ["a.wav"]), ex("e3", "essay")]} />);
        expect(screen.queryByRole("button", { name: "I can't speak" })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "I can't hear" }));
        expect(current()).toBe("e2");           // moved on to the next one
        await userEvent.click(screen.getByRole("button", { name: "I can't hear" }));
        expect(current()).toBe("e3");
        expect(screen.queryByRole("button", { name: /I can't/ })).toBeNull();
    });

    it("can't speak shows on recording exercises, and skipping the last one finishes with a skipped count", async () => {
        render(<ExercisePractice exercise_lists={[ex("e1", "speaking")]} />);
        expect(screen.queryByRole("button", { name: "I can't hear" })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "I can't speak" }));
        expect(screen.queryByTestId("runner")).toBeNull();
        expect(screen.getByRole("status")).toHaveTextContent("1 exercise skipped");
    });
});
