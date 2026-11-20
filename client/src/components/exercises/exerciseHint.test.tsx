// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getGrammarById: vi.fn(), getVocabularyById: vi.fn(), getCalligraphyById: vi.fn(), scoreExercise: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/grammar", () => ({ getGrammarById: api.getGrammarById }));
vi.mock("@/api/vocabulary", () => ({ getVocabularyById: api.getVocabularyById }));
vi.mock("@/api/calligraphy", () => ({ getCalligraphyById: api.getCalligraphyById }));
vi.mock("@/api/process", () => ({ scoreExercise: api.scoreExercise, overrideExercise: vi.fn() }));
vi.mock("@/components/elements/grammarCard", () => ({ default: ({ grammar }: { grammar: { explanation: string } }) => <p>{grammar.explanation}</p> }));

import ExerciseHint from "./exerciseHint";
import { creditExercise, hintsTaken } from "./creditExercise";

const exercise = { id: "ex_1", exercise_type: "translate", related_grammar: ["gram_1"], related_vocabulary: ["voc_1"], related_calligraphy: ["call_1"] } as never;

beforeEach(() => {
    api.getGrammarById.mockResolvedValue({ id: "gram_1", title: "是 (shì)", explanation: "A is B" });
    api.getVocabularyById.mockResolvedValue({ id: "voc_1", word: { word: "水", translation: "water", phonetic: "shuǐ" } });
    api.getCalligraphyById.mockResolvedValue({ id: "call_1", character: { character: "火", meaning: "fire", phonetic: "huǒ" } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("exercise hint (RC-25)", () => {
    it("step 1 opens the grammar sheet, step 2 adds the words and characters; each step is a hint taken", async () => {
        render(<ExerciseHint exercise={exercise} />);
        expect(api.getGrammarById).not.toHaveBeenCalled();                   // nothing is fetched until it is opened
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        const dialog = await screen.findByRole("dialog");
        expect(await screen.findByText("A is B")).toBeInTheDocument();
        expect(dialog).not.toHaveTextContent("water");
        expect(hintsTaken("ex_1")).toBe(1);
        await userEvent.click(screen.getByRole("button", { name: "Close" }));
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        expect(await screen.findByRole("dialog")).toHaveTextContent("water");
        expect(screen.getByRole("dialog")).toHaveTextContent("fire");
        expect(hintsTaken("ex_1")).toBe(2);
    });

    it("reading the hints again after the last step costs nothing", async () => {
        render(<ExerciseHint exercise={exercise} />);
        for (let i = 0; i < 3; i++) {
            await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
            await userEvent.click(await screen.findByRole("button", { name: "Close" }));
        }
        expect(hintsTaken("ex_1")).toBe(2);
    });

    it("an exercise linked to nothing still has the button, says so, and costs nothing", async () => {
        render(<ExerciseHint exercise={{ id: "ex_2" } as never} />);
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        expect(await screen.findByText("Nothing is linked to this exercise.")).toBeInTheDocument();
        expect(hintsTaken("ex_2")).toBe(0);
    });

    it("a hint taken lowers the credit of the attempt: the best quality after 1 hint is the shared cap, and the attempt is marked as hinted", async () => {
        render(<ExerciseHint exercise={exercise} />);
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        await creditExercise(exercise, 1, 1000, false, 1);
        const body = api.scoreExercise.mock.calls[0][1];
        expect(body.hintUsed).toBe(true);
        expect(Math.max(...body.results.map((r: { quality: number }) => r.quality))).toBeLessThanOrEqual(0.75);
        expect(hintsTaken("ex_1")).toBe(0);                                  // spent with the attempt
    });
});
