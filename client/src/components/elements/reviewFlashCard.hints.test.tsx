// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/process", () => api);
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("./calligraphyPracticeCanvas", () => ({ default: () => <div data-testid="canvas" /> }));

import ReviewFlashCard from "./reviewFlashCard";

const voc = (extra: Record<string, unknown> = {}) => ({
    id: "voc_1", card_id: "voc_1#front", side: "front", created_at: "2026-01-01T00:00:00",
    word: { word: "猫", translation: "cat", phonetic: "māo" },
    example_sentences: [{ text: "猫在睡觉", translation: "The cat sleeps." }],
    front_score: 30, front_difficulty: 0.5, back_score: 30, back_difficulty: 0.5, score: 30, difficulty: 0.5, ...extra,
}) as unknown as ReviewCard;

const flip = () => userEvent.click(screen.getByText("Click to reveal"));
beforeEach(() => vi.clearAllMocks());

describe("review card: hint ladder", () => {
    it("hint 1 shows the answer's shape and caps the best grade at good", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        await userEvent.click(screen.getByRole("button", { name: "Hint" }));
        expect(screen.getByText("Starts with: c _ _")).toBeInTheDocument();
        await flip();
        expect(screen.getByRole("button", { name: /Easy/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: /Good/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Good/ })).toHaveTextContent("Suggested");
    });

    it("hint 2 shows an example and caps the best grade at hard", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        await userEvent.click(screen.getByRole("button", { name: "Hint" }));
        await userEvent.click(screen.getByRole("button", { name: "Hint" }));
        expect(screen.getByText("Example: 猫在睡觉")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Hint" })).toBeDisabled();
        await flip();
        expect(screen.getByRole("button", { name: /Good/ })).toBeDisabled();
        await userEvent.click(screen.getByRole("button", { name: /Hard/ }));
        expect(api.updateScoreById).toHaveBeenCalledWith("voc_1", 0.5, expect.any(Number), true, undefined, "front");
    });

    it("a quick flip with no hint suggests easy and allows every grade", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        await flip();
        expect(screen.getByRole("button", { name: /Easy/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Easy/ })).toHaveTextContent("Suggested");
    });

    it("without an example the ladder stops after the first hint", async () => {
        render(<ReviewFlashCard cards={[voc({ example_sentences: [] })]} />);
        await userEvent.click(screen.getByRole("button", { name: "Hint" }));
        expect(screen.getByRole("button", { name: "Hint" })).toBeDisabled();
    });

    it("on the back side the hints are about the word and the example is blanked", async () => {
        render(<ReviewFlashCard cards={[voc({ side: "back", card_id: "voc_1#back" })]} />);
        await userEvent.click(screen.getByRole("button", { name: "Hint" }));
        expect(screen.getByText("Starts with: 猫")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Hint" }));
        expect(screen.getByText("Example: ___在睡觉 — The cat sleeps.")).toBeInTheDocument();
    });

    it("peeking counts as a hint for the cap", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        await userEvent.click(screen.getByRole("button", { name: "Peek" }));
        await flip();
        expect(screen.getByRole("button", { name: /Easy/ })).toBeDisabled();
    });
});
