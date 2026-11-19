// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TIER_LEARNING_DIFFICULTY } from "@/utils/cardTier";

const api = vi.hoisted(() => ({ getGrammarById: vi.fn() }));
vi.mock("@/api/grammar", () => api);
vi.mock("@/components/elements/grammarCard", () => ({ default: ({ grammar }: { grammar: { title: string } }) => <div data-testid="sheet">{grammar.title} body</div> }));

import LinkedGrammarSheet, { sheetOpen } from "./linkedGrammarSheet";

const grammar = (id: string, difficulty = 0.2) => ({ id, title: `Title ${id}`, explanation: "e", difficulty });
beforeEach(() => { vi.clearAllMocks(); api.getGrammarById.mockImplementation(async (id: string) => grammar(id)); });

describe("sheetOpen", () => {
    it("opens on a failure, a hint, or a difficulty above the learning tier's", () => {
        expect(sheetOpen({ failed: true, hintUsed: false, difficulty: 0 })).toBe(true);
        expect(sheetOpen({ failed: false, hintUsed: true, difficulty: 0 })).toBe(true);
        expect(sheetOpen({ failed: false, hintUsed: false, difficulty: TIER_LEARNING_DIFFICULTY + 0.01 })).toBe(true);
        expect(sheetOpen({ failed: false, hintUsed: false, difficulty: TIER_LEARNING_DIFFICULTY })).toBe(false);
    });
});

describe("linked grammar sheet", () => {
    it("renders nothing without a linked grammar", () => {
        const { container } = render(<LinkedGrammarSheet grammarIds={[]} failed hintUsed />);
        expect(container).toBeEmptyDOMElement();
    });

    it("stays away while nothing was failed, hinted or hard", async () => {
        const { container } = render(<LinkedGrammarSheet grammarIds={["gram_1"]} failed={false} hintUsed={false} />);
        await vi.waitFor(() => expect(api.getGrammarById).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it("offers a collapsed sheet per linked grammar after a failure", async () => {
        render(<LinkedGrammarSheet grammarIds={["gram_1", "gram_2"]} failed hintUsed={false} />);
        expect(await screen.findByText("Grammar sheet: Title gram_1")).toBeInTheDocument();
        expect(screen.getByText("Grammar sheet: Title gram_2")).toBeInTheDocument();
        expect(screen.getAllByRole("group").every((d) => !(d as HTMLDetailsElement).open)).toBe(true);
    });

    it("offers it after a hint", async () => {
        render(<LinkedGrammarSheet grammarIds={["gram_1"]} failed={false} hintUsed />);
        expect(await screen.findByText("Grammar sheet: Title gram_1")).toBeInTheDocument();
    });

    it("offers only the grammar that is still hard when nothing went wrong", async () => {
        api.getGrammarById.mockImplementation(async (id: string) => grammar(id, id === "gram_hard" ? 0.9 : 0.1));
        render(<LinkedGrammarSheet grammarIds={["gram_easy", "gram_hard"]} failed={false} hintUsed={false} />);
        expect(await screen.findByText("Grammar sheet: Title gram_hard")).toBeInTheDocument();
        expect(screen.queryByText("Grammar sheet: Title gram_easy")).toBeNull();
    });
});
