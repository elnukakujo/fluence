// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}), scoreTypedAnswer: vi.fn().mockRejectedValue(new Error("down")) }));
vi.mock("@/api/process", () => api);
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("./calligraphyPracticeCanvas", () => ({ default: () => <div data-testid="canvas" /> }));

import ReviewFlashCard from "./reviewFlashCard";

const voc = (side: "front" | "back", score = 80) => ({
    id: "voc_1", card_id: `voc_1#${side}`, side, created_at: "2026-01-01T00:00:00",
    word: { word: "猫", translation: "cat", phonetic: "māo" }, example_sentences: [{ text: "猫在睡觉", translation: "The cat sleeps." }],
    front_score: score, front_difficulty: 0.3, back_score: score, back_difficulty: 0.3, score, difficulty: 0.3,
}) as unknown as ReviewCard;
const call = (score: number) => ({ id: "call_1", created_at: "2026-01-01T00:00:00", score, difficulty: 0.3, character: { character: "日", phonetic: "rì", strokes: 4 } }) as unknown as ReviewCard;

beforeEach(() => vi.clearAllMocks());

describe("review card: type the word", () => {
    it("a maintaining back-side card asks you to type the word; right and fast is easy", async () => {
        render(<ReviewFlashCard cards={[voc("back")]} />);
        expect(screen.queryByText("Click to reveal")).toBeNull();
        await userEvent.type(screen.getByLabelText("Type the word"), "猫");
        await userEvent.click(screen.getByRole("button", { name: "Check" }));
        expect(api.updateScoreById).toHaveBeenCalledWith("voc_1", 1, expect.any(Number), false, undefined, "back");
        expect(screen.getByText("Right!")).toBeInTheDocument();
    });

    it("a wrong answer is graded again and shows the word", async () => {
        render(<ReviewFlashCard cards={[voc("back")]} />);
        await userEvent.type(screen.getByLabelText("Type the word"), "狗");
        await userEvent.click(screen.getByRole("button", { name: "Check" }));
        expect(api.updateScoreById).toHaveBeenCalledWith("voc_1", 0, expect.any(Number), false, undefined, "back");
        expect(screen.getByText("Not quite. The word is 猫")).toBeInTheDocument();
    });

    it("a near miss earns partial credit and underlines the differing character", async () => {
        api.scoreTypedAnswer.mockResolvedValueOnce({ closeness: 0.65, diff: [0] });
        render(<ReviewFlashCard cards={[voc("back")]} />);
        await userEvent.type(screen.getByLabelText("Type the word"), "狗");
        await userEvent.click(screen.getByRole("button", { name: "Check" }));
        const grade = api.updateScoreById.mock.calls[0][1];
        expect(grade).toBeGreaterThan(0);
        expect(grade).toBeLessThan(0.75);
        expect(await screen.findByLabelText("different: 猫")).toBeInTheDocument();
    });

    it("a failed request keeps the exact-match grade", async () => {
        render(<ReviewFlashCard cards={[voc("back")]} />);
        await userEvent.type(screen.getByLabelText("Type the word"), "狗");
        await userEvent.click(screen.getByRole("button", { name: "Check" }));
        expect(api.updateScoreById).toHaveBeenCalledWith("voc_1", 0, expect.any(Number), false, undefined, "back");
    });

    it("I don't know is graded again", async () => {
        render(<ReviewFlashCard cards={[voc("back")]} />);
        await userEvent.click(screen.getByRole("button", { name: "I don't know" }));
        expect(api.updateScoreById).toHaveBeenCalledWith("voc_1", 0, expect.any(Number), false, undefined, "back");
    });

    it("a hint caps what a right answer can earn", async () => {
        render(<ReviewFlashCard cards={[voc("back")]} />);
        await userEvent.click(screen.getByRole("button", { name: "Hint" }));
        await userEvent.type(screen.getByLabelText("Type the word"), "猫");
        await userEvent.click(screen.getByRole("button", { name: "Check" }));
        expect(api.updateScoreById).toHaveBeenCalledWith("voc_1", 0.75, expect.any(Number), true, undefined, "back");
    });

    it("flip instead falls back to the normal card", async () => {
        render(<ReviewFlashCard cards={[voc("back")]} />);
        await userEvent.click(screen.getByRole("button", { name: "Flip instead" }));
        expect(screen.getByText("Click to reveal")).toBeInTheDocument();
        expect(screen.queryByLabelText("Type the word")).toBeNull();
    });

    it("only the back side of a maintaining card is typed", () => {
        const a = render(<ReviewFlashCard cards={[voc("front")]} />);
        expect(screen.queryByLabelText("Type the word")).toBeNull();
        a.unmount();
        render(<ReviewFlashCard cards={[voc("back", 40)]} />);
        expect(screen.queryByLabelText("Type the word")).toBeNull();
    });

    it("a maintaining calligraphy card opens the drawing canvas by itself", () => {
        const a = render(<ReviewFlashCard cards={[call(80)]} />);
        expect(screen.getByTestId("canvas")).toBeInTheDocument();
        a.unmount();
        render(<ReviewFlashCard cards={[call(40)]} />);
        expect(screen.queryByTestId("canvas")).toBeNull();
    });
});
