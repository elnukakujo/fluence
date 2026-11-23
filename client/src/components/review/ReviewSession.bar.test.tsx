// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ score: vi.fn() }));
vi.mock("@/api/process", () => ({ updateScoreById: m.score }));
vi.mock("@/api/review", () => ({ completeReview: vi.fn().mockResolvedValue({ validated: false, streak: 0 }), saveCardNote: vi.fn() }));
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

import ReviewSession from "./ReviewSession";

const word = (side: "front" | "back") => ({ id: "voc_1", card_id: `voc_1#${side}`, side, created_at: "2026-01-01T00:00:00", word: { word: "水", translation: "water" }, example_sentences: [] }) as never;

beforeEach(() => vi.clearAllMocks());

describe("the pinned bar in a review", () => {
    it("holds the grade buttons first, then the result strip with a level-up marker over Next", async () => {
        m.score.mockResolvedValue({ score_before: 55, score_after: 64, level_before: "learning", level_after: "known" });
        render(<ReviewSession items={[word("front"), word("back")]} options={{ languageId: "lang1" }} />);
        await userEvent.click(screen.getByText("Click to reveal"));
        expect(screen.getByTestId("action-bar")).toContainElement(screen.getByText(/good/i));
        await userEvent.click(screen.getByText(/good/i));
        expect(await screen.findByTestId("result-strip")).toHaveTextContent("+9 points");
        expect(screen.getByTestId("level-up")).toBeInTheDocument();
        expect(screen.getByTestId("action-bar")).toContainElement(screen.getByRole("button", { name: /^Next$/ }));
    });
    it("shows Next without a strip number when the answer response carries no score", async () => {
        m.score.mockResolvedValue({});
        render(<ReviewSession items={[word("front"), word("back")]} options={{ languageId: "lang1" }} />);
        await userEvent.click(screen.getByText("Click to reveal"));
        await userEvent.click(screen.getByText(/good/i));
        expect(screen.getByRole("button", { name: /^Next$/ })).toBeInTheDocument();
        expect(screen.queryByTestId("level-up")).toBeNull();
    });
});

describe("resume", () => {
    it("a reopened queue skips the cards already answered and keeps the same session", async () => {
        localStorage.clear();
        window.history.pushState({}, "", "/languages/lang1/review/queue?scope=type&type=vocabulary");
        m.score.mockResolvedValue({});
        const first = render(<ReviewSession items={[word("front"), word("back")]} options={{ languageId: "lang1" }} />);
        await userEvent.click(screen.getByText("Click to reveal"));
        await userEvent.click(screen.getByText(/good/i));
        await userEvent.click(screen.getByRole("button", { name: /^Next$/ }));
        first.unmount();
        render(<ReviewSession items={[word("front"), word("back")]} options={{ languageId: "lang1" }} />);
        await userEvent.click(await screen.findByText("Click to reveal"));
        await userEvent.click(screen.getByText(/good/i));
        expect(screen.queryByRole("button", { name: /^Next$/ })).toBeNull();           // the front was skipped: this was the last card, so the end screen's bar is up
        expect(await screen.findByTestId("summary-bar")).toBeInTheDocument();
        expect(localStorage.getItem("review-resume:/languages/lang1/review/queue?scope=type&type=vocabulary")).toBeNull();      // finished: nothing to resume
    });
});
