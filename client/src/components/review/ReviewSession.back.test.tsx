// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ push: vi.fn(), completeReview: vi.fn().mockResolvedValue({ validated: false, streak: 0 }) }));
vi.mock("@/api/process", () => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/review", () => ({ completeReview: m.completeReview, saveCardNote: vi.fn() }));
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: m.push, back: vi.fn() }) }));

import ReviewSession from "./ReviewSession";

const word = { id: "voc_1", card_id: "voc_1#front", side: "front", created_at: "2026-01-01T00:00:00", word: { word: "水", translation: "water" }, example_sentences: [] } as never;

beforeEach(() => { vi.clearAllMocks(); window.history.pushState({}, "", "/languages/lang1/review/queue?scope=type&type=vocabulary"); });

describe("leaving a finished review", () => {
    it("goes to the language page, not to the daily review that is the queue page's parent path", async () => {
        render(<ReviewSession items={[word]} options={{ languageId: "lang1" }} />);
        await userEvent.click(screen.getByText("Click to reveal"));
        await userEvent.click(screen.getByText(/good/i));
        await userEvent.click(screen.getByRole("button", { name: /Back to Language/i }));
        expect(m.push).toHaveBeenCalledWith("/languages/lang1");
    });

    it("an empty queue leaves for the language page too", async () => {
        render(<ReviewSession items={[]} options={{ languageId: "lang1" }} />);
        await userEvent.click(screen.getByRole("button", { name: /Back to Language/i }));
        expect(m.push).toHaveBeenCalledWith("/languages/lang1");
    });
});
