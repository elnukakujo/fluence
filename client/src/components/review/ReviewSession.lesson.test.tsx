// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const m = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}), completeReview: vi.fn().mockResolvedValue({ validated: true, just_validated: true, streak: 3 }) }));
vi.mock("@/api/process", () => ({ updateScoreById: m.updateScoreById }));
vi.mock("@/api/review", () => ({ completeReview: m.completeReview, saveCardNote: vi.fn() }));
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

import ReviewSession from "./ReviewSession";

const word = (side: "front" | "back") => ({ id: "voc_1", card_id: `voc_1#${side}`, side, created_at: "2026-01-01T00:00:00", word: { word: "水", translation: "water" }, example_sentences: [] }) as unknown as ReviewCard;
const flip = () => userEvent.click(screen.getByText("Click to reveal"));

beforeEach(() => vi.clearAllMocks());

describe("session as lesson study", () => {
    it("finishes with the lesson action and validates the streak day (RC-17, RD-3)", async () => {
        render(<ReviewSession items={[word("front")]} options={{ languageId: "lang1", finishAction: "lesson" }} />);
        await flip();
        await userEvent.click(screen.getByText(/good/i));
        expect(m.completeReview).toHaveBeenCalledWith("lang1", 1);                       // the day counts as soon as the last card is answered
        await userEvent.click(screen.getByRole("button", { name: "See results" }));
        expect(screen.getByRole("button", { name: /Back to lesson/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Back to Language/i })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: /Back to lesson/i }));
        expect(m.completeReview).toHaveBeenCalledWith("lang1", 1);
    });

    it("the daily review still finishes with the language action and completes the day", async () => {
        render(<ReviewSession items={[word("front")]} options={{ languageId: "lang1" }} />);
        await flip();
        await userEvent.click(screen.getByText(/good/i));
        await userEvent.click(screen.getByRole("button", { name: "See results" }));
        await userEvent.click(screen.getByRole("button", { name: /Back to Language/i }));
        expect(m.completeReview).toHaveBeenCalledWith("lang1", 1);
    });

    it("the two sides of one word are two cards: grading the front leads to the back", async () => {
        render(<ReviewSession items={[word("front"), word("back")]} options={{ languageId: "lang1", finishAction: "lesson" }} />);
        await flip();
        await userEvent.click(screen.getByText(/good/i));
        await userEvent.click(screen.getByRole("button", { name: /^Next$/ }));
        // now the back side: it asks with the translation
        const front = document.querySelector(".flashcard-face:not(.flashcard-face-back)") as HTMLElement;
        expect(front).toHaveTextContent("water");
        expect(m.updateScoreById).toHaveBeenCalledWith("voc_1", expect.objectContaining({ similarity: 0.75, hintUsed: true, side: "front", skill: "recognition", evidence: "self_grade" }));
    });

    it("an empty lesson shows nothing to review instead of crashing", () => {
        render(<ReviewSession items={[]} options={{ finishAction: "lesson" }} />);
        expect(screen.getByText(/Nothing to review/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Back to lesson/i })).toBeInTheDocument();
    });
});
