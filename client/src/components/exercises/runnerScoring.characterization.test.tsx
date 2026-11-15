// @vitest-environment jsdom
// Pins today's score payloads per runner so the useAttemptScoring refactor (plan Tasks 9-10) cannot change them.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { evaluateText, updateScoreById } from "@/api/process";

vi.mock("@/api/process", () => ({ updateScoreById: vi.fn().mockResolvedValue({}), evaluateText: vi.fn() }));
vi.mock("@/api/exercise", () => ({ generateLineAudio: vi.fn() }));

import ExerciseRunner from "./exerciseRunner";

const make = (type: string, content: unknown) => ({ id: "ex1", exercise_type: type, content, question: "q", answer: "a", audio_files: [], related_vocabulary: [], related_grammar: [], related_characters: [], related_calligraphy: [] }) as unknown as Exercise;
const ev = (correct: boolean, score: number) => vi.mocked(evaluateText).mockResolvedValueOnce({ correct, score, feedback: "f" } as never);
const check = () => fireEvent.click(screen.getByRole("button", { name: /check/i }));
const calls = () => vi.mocked(updateScoreById).mock.calls.map(([, ...rest]) => rest.map((v, i) => (i === 1 ? typeof v : v)));
const setup = (type: string, content: unknown) => {
    const onFinished = vi.fn();
    render(<ExerciseRunner exercise={make(type, content)} onFinished={onFinished} />);
    return onFinished;
};

beforeEach(() => { vi.mocked(updateScoreById).mockClear(); vi.mocked(evaluateText).mockReset(); });
afterEach(cleanup);

describe("closed-answer runners: one attempt, wrong is final", () => {
    it.each([
        ["true_false", { statement: "s", answer: true }, "False", "True"],
        ["quizz", { options: ["x", "y"], correct: [1] }, "x", "y"],
    ])("%s", (type, content, wrong, right) => {
        let fin = setup(type, content);
        fireEvent.click(screen.getByRole("button", { name: wrong as string }));
        check();
        expect(calls()).toEqual([[0, "number", false, 1]]);
        expect(fin).toHaveBeenCalledTimes(1);
        cleanup(); vi.mocked(updateScoreById).mockClear();
        fin = setup(type, content);
        fireEvent.click(screen.getByRole("button", { name: right as string }));
        check();
        expect(calls()).toEqual([[1, "number", false, 1]]);
        expect(fin).toHaveBeenCalledTimes(1);
    });
});

describe("select_in_the_blank: 3 attempts, score sent on success or the 3rd miss", () => {
    const content = { segments: ["a ", " b"], blanks: [{ answer: "x", options: ["x", "y"] }] };
    it("wrong sends nothing, then right sends attempt 2", () => {
        const fin = setup("select_in_the_blank", content);
        fireEvent.click(screen.getByRole("button", { name: "y" }));
        check();
        expect(calls()).toEqual([]);
        expect(fin).not.toHaveBeenCalled();
        fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent === "y")!); // empty the blank
        fireEvent.click(screen.getByRole("button", { name: "x" }));
        check();
        expect(calls()).toEqual([[1, "number", false, 2]]);
        expect(fin).toHaveBeenCalledTimes(1);
    });
});

describe("evaluated runners: wrong sends nothing until the 3rd miss, right sends the evaluator score", () => {
    const cases: [string, unknown, () => void][] = [
        ["type_in_the_blank", { segments: ["a ", " b"], blanks: [{ answer: "x" }] }, () => fireEvent.change(screen.getByRole("textbox"), { target: { value: "z" } })],
        ["translate", null, () => fireEvent.change(screen.getByRole("textbox"), { target: { value: "z" } })],
        ["organize", { items: ["a", "b"], answer_order: [1, 0] }, () => fireEvent.click(screen.getByRole("button", { name: "a" }))],
    ];
    it.each(cases)("%s: wrong then right", async (type, content, fill) => {
        const fin = setup(type, content);
        fill();
        ev(false, 0.2); check();
        await waitFor(() => expect(evaluateText).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByRole("button", { name: /check/i })).toBeEnabled());
        expect(calls()).toEqual([]);
        ev(true, 0.9); check();
        await waitFor(() => expect(calls()).toEqual([[0.9, "number", false, 2]]));
        expect(fin).toHaveBeenCalledTimes(1);
    });
    it.each(cases)("%s: third miss sends attempt 3", async (type, content, fill) => {
        const fin = setup(type, content);
        fill();
        for (let n = 1; n <= 3; n++) {
            ev(false, 0.1); check();
            await waitFor(() => expect(evaluateText).toHaveBeenCalledTimes(n));
            if (n < 3) await waitFor(() => expect(screen.getByRole("button", { name: /check/i })).toBeEnabled());
        }
        await waitFor(() => expect(calls()).toEqual([[0.1, "number", false, 3]]));
        expect(fin).toHaveBeenCalledTimes(1);
    });
});
