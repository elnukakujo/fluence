// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/process", () => api);
vi.mock("@/api/review", () => ({ completeReview: vi.fn(), saveCardNote: vi.fn() }));
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("./calligraphyPracticeCanvas", () => ({ default: () => <div /> }));

import ReviewFlashCard from "./reviewFlashCard";

const leechy = (side: "front" | "back", confusable: { word: string; translation: string } | null = { word: "貓", translation: "kitten" }) => ({
    id: "voc_1", card_id: `voc_1#${side}`, side, created_at: "2026-01-01T00:00:00",
    word: { word: "猫", translation: "cat", phonetic: "māo" }, example_sentences: [],
    front_score: 30, front_difficulty: 0.5, back_score: 30, back_difficulty: 0.5, score: 30, difficulty: 0.5, note: "furry",
    leech: { lapses: 6, parts: [], confusable },
}) as unknown as ReviewCard;

beforeEach(() => vi.clearAllMocks());

describe("review card: leech", () => {
    it("a normal card has no leech panel", () => {
        render(<ReviewFlashCard cards={[{ ...leechy("front"), leech: undefined } as unknown as ReviewCard]} />);
        expect(screen.queryByText(/keeps slipping/)).toBeNull();
    });

    it("shows the banner and the personal note, and asks to choose between the word and its look-alike first", () => {
        render(<ReviewFlashCard cards={[leechy("front")]} />);
        expect(screen.getByText(/keeps slipping \(6 misses\)/)).toBeInTheDocument();
        expect(screen.getByLabelText("Your memory trick")).toHaveValue("furry");
        expect(screen.getByText("Which meaning goes with 猫?")).toBeInTheDocument();
        expect(screen.queryByText("Click to reveal")).toBeNull();
    });

    it("the right choice continues to the card, assisted: the best grade is limited", async () => {
        render(<ReviewFlashCard cards={[leechy("front")]} />);
        await userEvent.click(screen.getByRole("button", { name: "cat" }));
        await userEvent.click(screen.getByText("Click to reveal"));
        expect(screen.getByRole("button", { name: /Easy/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: /Good/ })).toBeEnabled();
    });

    it("the wrong choice grades again and shows the answer", async () => {
        render(<ReviewFlashCard cards={[leechy("front")]} />);
        await userEvent.click(screen.getByRole("button", { name: "kitten" }));
        expect(api.updateScoreById).toHaveBeenCalledWith("voc_1", 0, expect.any(Number), false, undefined, "front");
    });

    it("on the back side the choice is between the two words", async () => {
        render(<ReviewFlashCard cards={[leechy("back")]} />);
        expect(screen.getByText("Which word means cat?")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "猫" }));
        expect(screen.queryByText("Which word means cat?")).toBeNull();
    });

    it("a leech with no look-alike goes straight to the card", () => {
        render(<ReviewFlashCard cards={[leechy("front", null)]} />);
        expect(screen.getByText("Click to reveal")).toBeInTheDocument();
    });
});
