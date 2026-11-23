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
vi.mock("@/components/elements/calligraphyPracticeCanvas", () => ({ default: () => <div data-testid="canvas" /> }));

import ReviewSession from "./ReviewSession";

// the render calls below predate the shell's items/options props: this adapter keeps them (and every assertion) as they were
const ReviewFlashCard = ({ cards, languageId }: { cards: Parameters<typeof ReviewSession>[0]["items"]; languageId?: string }) => <ReviewSession items={cards} options={{ languageId }} />;

const voc = (extra: Record<string, unknown> = {}) => ({
    id: "voc_1", card_id: "voc_1#front", side: "front", created_at: "2026-01-01T00:00:00",
    word: { word: "猫", translation: "cat", phonetic: "māo" },
    example_sentences: [{ text: "猫在睡觉", translation: "The cat sleeps." }],
    front_score: 70, front_difficulty: 0.5, back_score: 70, back_difficulty: 0.5, score: 70, difficulty: 0.5, ...extra,
}) as unknown as ReviewCard;

const flip = () => userEvent.click(screen.getByText("Click to reveal"));
beforeEach(() => vi.clearAllMocks());

describe("review card: hint ladder", () => {
    it("hint 1 shows the answer's shape and suggests good, every grade stays available", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        expect(screen.getByText("Starts with: c _ _")).toBeInTheDocument();
        await flip();
        expect(screen.getByRole("button", { name: /Easy/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Good/ })).toHaveTextContent("Suggested");
    });

    it("hint 2 shows an example and suggests hard; the user can still pick another grade", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        expect(screen.getByText("Example: 猫在睡觉")).toBeInTheDocument();
        await flip();
        expect(screen.getByRole("button", { name: /Hard/ })).toHaveTextContent("Suggested");
        await userEvent.click(screen.getByRole("button", { name: /Good/ }));
        expect(api.updateScoreById).toHaveBeenCalledWith("voc_1", expect.objectContaining({ similarity: 0.75, hintUsed: true, side: "front", skill: "recognition", evidence: "self_grade" }));
    });

    it("a quick flip with no hint suggests easy and allows every grade", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        await flip();
        expect(screen.getByRole("button", { name: /Easy/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Easy/ })).toHaveTextContent("Suggested");
    });

    it("the hint button sits above the card, not under it", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        const hint = screen.getByRole("button", { name: /^Hint/ });
        expect(hint.compareDocumentPosition(screen.getByText("Click to reveal")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("a hint costs points, so a card with nothing new to say has no Hint button and no filler step", async () => {
        render(<ReviewFlashCard cards={[voc({ example_sentences: [], word: { word: "好", translation: "", phonetic: "hǎo" } })]} />);
        expect(screen.queryByRole("button", { name: /^Hint/ })).toBeNull();
        expect(screen.queryByText(/Take your time/)).toBeNull();
    });

    it("the button shows how many hints are taken and the best grade that is left", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        const hint = screen.getByRole("button", { name: /^Hint/ });
        expect(hint).not.toHaveTextContent("Best grade");
        await userEvent.click(hint);
        expect(screen.getByRole("button", { name: /^Hint/ })).toHaveTextContent("Best grade now: Good");
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        expect(screen.getByRole("button", { name: /^Hint/ })).toHaveTextContent("Best grade now: Hard");
    });

    it("on the back side the hints are about the word and the example is blanked", async () => {
        render(<ReviewFlashCard cards={[voc({ side: "back", card_id: "voc_1#back" })]} />);
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        // a one-character word has no shape hint (it would be the answer): its length, then the sound, then the example
        expect(screen.queryByText(/Starts with/)).toBeNull();
        expect(screen.getByText("The answer is 1 character long")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        expect(screen.getByText("Example: ___在睡觉 — The cat sleeps.")).toBeInTheDocument();
    });

    it("the hints appear above the card, in the flow, where the user is looking", async () => {
        render(<ReviewFlashCard cards={[voc()]} />);
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        const hint = screen.getByText("Starts with: c _ _");
        expect(hint.compareDocumentPosition(screen.getByText("Click to reveal")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(hint.closest(".absolute")).toBeNull();
    });

    it("a learning card already shows its example, so the ladder does not repeat it", async () => {
        render(<ReviewFlashCard cards={[voc({ score: 10, front_score: 10 })]} />);
        expect(screen.getByText("猫在睡觉")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        expect(screen.getByRole("button", { name: /^Hint/ })).toBeDisabled();
        expect(screen.queryByText(/^Example:/)).toBeNull();
    });

    it("the back side never shows the example sentence on the front: it contains the answer", () => {
        render(<ReviewFlashCard cards={[voc({ side: "back", card_id: "voc_1#back", score: 10, back_score: 10 })]} />);
        expect(screen.queryByText("猫在睡觉")).toBeNull();
    });

    it("a learning back card still offers the blanked example as a hint", async () => {
        render(<ReviewFlashCard cards={[voc({ side: "back", card_id: "voc_1#back", score: 10, back_score: 10 })]} />);
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        await userEvent.click(screen.getByRole("button", { name: /^Hint/ }));
        expect(screen.getByText("Example: ___在睡觉 — The cat sleeps.")).toBeInTheDocument();
    });
});
