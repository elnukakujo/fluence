// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const m = vi.hoisted(() => ({
    updateScoreById: vi.fn().mockResolvedValue({}),
    completeReview: vi.fn().mockResolvedValue({ validated: true, just_validated: true, streak: 3 }),
    deleteElement: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/api/process", () => ({ updateScoreById: m.updateScoreById }));
vi.mock("@/api/review", () => ({ completeReview: m.completeReview, saveCardNote: vi.fn() }));
vi.mock("@/api", () => ({ deleteElement: m.deleteElement }));
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

import ReviewSession from "./ReviewSession";

const side = (id: string, s: "front" | "back", text: string) => ({ id, card_id: `${id}#${s}`, side: s, created_at: "2026-01-01T00:00:00", word: { word: text, translation: "t" }, example_sentences: [] }) as unknown as ReviewCard;
const grammar = (id: string, title: string) => ({ id, kind: "grammar", title, explanation: "e", created_at: "2026-01-01T00:00:00", example_sentences: [] }) as unknown as ReviewCard;
const deleteBtn = () => screen.getByRole("button", { name: "Delete" });
const shown = (text: string) => screen.queryAllByText(text).length > 0;       // a flashcard's title sits on both faces
const confirm = async () => userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /confirm delete/i }));

beforeEach(() => { vi.clearAllMocks(); m.deleteElement.mockResolvedValue({}); });

describe("delete from a review (RC-23)", () => {
    it("is offered before the card is answered", () => {
        render(<ReviewSession items={[grammar("gram_1", "Subjunctive")]} options={{ languageId: "lang1" }} />);
        expect(deleteBtn()).toBeInTheDocument();
    });

    it("cancel deletes nothing", async () => {
        render(<ReviewSession items={[grammar("gram_1", "Subjunctive")]} options={{ languageId: "lang1" }} />);
        await userEvent.click(deleteBtn());
        await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /cancel/i }));
        expect(m.deleteElement).not.toHaveBeenCalled();
        expect(shown("Subjunctive")).toBe(true);
    });

    it("confirming deletes the element, writes no score and shows the next card", async () => {
        render(<ReviewSession items={[grammar("gram_1", "Subjunctive"), grammar("gram_2", "Conditional")]} options={{ languageId: "lang1" }} />);
        await userEvent.click(deleteBtn());
        await confirm();
        expect(m.deleteElement).toHaveBeenCalledWith("gram_1");
        await vi.waitFor(() => expect(shown("Conditional")).toBe(true));
        expect(shown("Subjunctive")).toBe(false);
        expect(m.updateScoreById).not.toHaveBeenCalled();
    });

    it("deleting a vocabulary removes its other side too", async () => {
        render(<ReviewSession items={[side("voc_1", "front", "水"), side("voc_1", "back", "水"), grammar("gram_2", "Conditional")]} options={{ languageId: "lang1" }} />);
        await userEvent.click(deleteBtn());
        await confirm();
        await vi.waitFor(() => expect(shown("Conditional")).toBe(true));
        expect(m.deleteElement).toHaveBeenCalledTimes(1);
    });

    it("deleting the last card after answering another ends the session once", async () => {
        render(<ReviewSession items={[grammar("gram_1", "Subjunctive"), grammar("gram_2", "Conditional")]} options={{ languageId: "lang1" }} />);
        await userEvent.click(screen.getByText("Click to reveal"));        // grammar: flipping grades it
        await userEvent.click(screen.getByRole("button", { name: /^Next$/ }));
        await userEvent.click(deleteBtn());
        await confirm();
        expect(await screen.findByText(/nothing to review/i)).toBeInTheDocument();
        await vi.waitFor(() => expect(m.completeReview).toHaveBeenCalledTimes(1));
    });

    it("a refused delete keeps the card and says so", async () => {
        m.deleteElement.mockRejectedValue(new Error("403"));
        render(<ReviewSession items={[grammar("gram_1", "Subjunctive")]} options={{ languageId: "lang1" }} />);
        await userEvent.click(deleteBtn());
        await confirm();
        expect(await screen.findByRole("alert")).toHaveTextContent(/could not delete/i);
        expect(shown("Subjunctive")).toBe(true);
    });
});
