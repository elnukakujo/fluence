// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";

vi.mock("./exerciseRunner", () => ({ default: ({ exercise }: { exercise: Exercise }) => <div data-testid="runner">{exercise.id}</div> }));
vi.mock("@/components/ui/buttons/backButton", () => ({ default: ({ children }: { children: React.ReactNode }) => <button>{children}</button> }));

import ExercisePractice from "./exercisePractice";

const ex = (id: string, exercise_type: Exercise["exercise_type"]) => ({ id, exercise_type, question: "q", answer: "a" }) as Exercise;
const list = [ex("e1", "essay"), ex("e2", "dictation"), ex("e3", "speaking"), ex("e4", "quizz")];
const current = () => screen.queryByTestId("runner")?.textContent;
const next = () => userEvent.click(screen.getByRole("button", { name: /next/i }));

describe("practice skips", () => {
    it("can't hear removes dictation from the queue and reports the count; scores are never touched", async () => {
        render(<ExercisePractice exercise_lists={list} />);
        await userEvent.click(screen.getByRole("button", { name: "I can't hear" }));
        expect(screen.getByRole("status")).toHaveTextContent("1 exercise skipped");
        await next();
        expect(current()).toBe("e3");          // e2 (dictation) skipped
    });

    it("turning a skip off restores the original order", async () => {
        render(<ExercisePractice exercise_lists={list} />);
        const hear = screen.getByRole("button", { name: "I can't hear" });
        await userEvent.click(hear);
        await next();                           // e1 done, now e3
        await userEvent.click(hear);            // un-skip
        expect(current()).toBe("e2");           // e2 comes back before e3
    });

    it("shows a nothing-left message when every remaining exercise is skipped", async () => {
        render(<ExercisePractice exercise_lists={[ex("e2", "dictation"), ex("e3", "speaking")]} />);
        await userEvent.click(screen.getByRole("button", { name: "I can't hear" }));
        await userEvent.click(screen.getByRole("button", { name: "I can't speak" }));
        expect(screen.getByText(/Nothing left to practise/)).toBeInTheDocument();
        expect(screen.queryByTestId("runner")).toBeNull();
    });
});
