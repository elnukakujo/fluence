// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import fixtures from "@/test/exerciseContent.json";

vi.mock("@/api/process", () => ({ updateScoreById: vi.fn().mockResolvedValue({}), evaluateText: vi.fn() }));
vi.mock("@/api/exercise", () => ({ generateLineAudio: vi.fn() }));

import ExerciseRunner from "./exerciseRunner";

const make = (type: string, content: unknown) => ({ id: "ex", exercise_type: type, content, question: "q", answer: "the answer", audio_files: [], related_vocabulary: [], related_grammar: [], related_characters: [], related_calligraphy: [] }) as unknown as Exercise;

describe("give-up", () => {
    it.each((fixtures.good as [string, unknown][]).filter(([t]) => t !== "conversation" && t !== "speaking"))("%s reveals its answer and locks its inputs", (type, content) => {
        const { container } = render(<ExerciseRunner exercise={make(type, content)} gaveUp />);
        expect(screen.getByRole("status")).toHaveTextContent("The correct answer is:");
        expect(container.querySelector("fieldset")).toBeDisabled();
    });
});

describe("onFinished", () => {
    it("quizz fires it once when solved", () => {
        const onFinished = vi.fn();
        render(<ExerciseRunner exercise={make("quizz", { options: ["x", "y"], correct: [1] })} onFinished={onFinished} />);
        fireEvent.click(screen.getByRole("button", { name: "y" }));
        fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
        expect(onFinished).toHaveBeenCalledTimes(1);
    });

    it("quizz fires it once on a wrong answer too (single attempt)", () => {
        const onFinished = vi.fn();
        render(<ExerciseRunner exercise={make("quizz", { options: ["x", "y"], correct: [1] })} onFinished={onFinished} />);
        fireEvent.click(screen.getByRole("button", { name: "x" }));
        fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
        expect(onFinished).toHaveBeenCalledTimes(1);
    });

    it("quizz does not fire it before an answer", () => {
        const onFinished = vi.fn();
        render(<ExerciseRunner exercise={make("quizz", { options: ["x", "y"], correct: [1] })} onFinished={onFinished} />);
        expect(onFinished).not.toHaveBeenCalled();
    });
});
