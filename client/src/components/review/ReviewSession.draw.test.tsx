// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const m = vi.hoisted(() => ({
    submitCalligraphyDrawing: vi.fn().mockResolvedValue({}),
    loadStrokeData: vi.fn(),
    isDrawFirst: vi.fn(),
    guidance: "none" as string,
    onResult: null as null | ((r: { similarity: number; strokeOrderErrors: number }) => void),
}));
vi.mock("@/api/process", () => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: m.submitCalligraphyDrawing }));
vi.mock("@/lib/calligraphy/strokeData", () => ({ loadStrokeData: m.loadStrokeData }));
vi.mock("@/utils/drawFirst", () => ({ isDrawFirst: m.isDrawFirst }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/elements/calligraphyPracticeCanvas", () => ({
    default: (p: { onResult: typeof m.onResult; info?: React.ReactNode }) => { m.onResult = p.onResult; return <div data-testid="canvas">{p.info}</div>; },
    guidanceFor: () => m.guidance,
}));

import ReviewSession from "./ReviewSession";

// the render calls below predate the shell's items/options props: this adapter keeps them (and every assertion) as they were
const ReviewFlashCard = ({ cards, languageId }: { cards: Parameters<typeof ReviewSession>[0]["items"]; languageId?: string }) => <ReviewSession items={cards} options={{ languageId }} />;

const call = (score: number) => ({ id: "call_1", created_at: "2026-01-01T00:00:00", score, difficulty: 0.5, character: { character: "日", phonetic: "rì", strokes: 4 } }) as unknown as ReviewCard;

beforeEach(() => { vi.clearAllMocks(); m.loadStrokeData.mockResolvedValue([[]]); m.isDrawFirst.mockReturnValue(true); m.guidance = "none"; });

const built = (score: number) => ({ ...call(score), character: { character: "河", phonetic: "hé", meaning: "river", strokes: 8,
    key_radical: { id: "c2", character: "氵" }, component_refs: [{ id: "c2", character: "氵" }, { id: "c3", character: "可" }] } }) as unknown as ReviewCard;

describe("review card: radicals and components", () => {
    it("the drawing card shows the radical and the components at every tier, as plain characters (no link out of the session)", () => {
        for (const score of [40, 90]) {
            const { unmount } = render(<ReviewFlashCard cards={[built(score)]} />);
            const canvas = screen.getByTestId("canvas");
            expect(canvas).toHaveTextContent("氵");
            expect(canvas).toHaveTextContent("可");
            expect(canvas.querySelectorAll("a")).toHaveLength(0);
            unmount();
        }
    });

    it("the flip card shows them on its front, before the answer is revealed", () => {
        m.isDrawFirst.mockReturnValue(false);
        render(<ReviewFlashCard cards={[built(40)]} />);
        expect(screen.queryByTestId("canvas")).toBeNull();
        expect(screen.getAllByText("可").length).toBeGreaterThan(0);
        expect(screen.queryAllByRole("link")).toHaveLength(0);
    });
});

describe("review card: draw-first calligraphy", () => {
    it("a draw-first day shows the canvas instead of the flip card", () => {
        render(<ReviewFlashCard cards={[call(40)]} />);
        expect(screen.getByTestId("canvas")).toBeInTheDocument();
    });

    it("an ordinary day keeps the flip card", () => {
        m.isDrawFirst.mockReturnValue(false);
        render(<ReviewFlashCard cards={[call(40)]} />);
        expect(screen.queryByTestId("canvas")).toBeNull();
    });

    it("I can't draw falls back to the flip card", async () => {
        render(<ReviewFlashCard cards={[call(40)]} />);
        await userEvent.click(screen.getByRole("button", { name: "I can't draw" }));
        expect(screen.queryByTestId("canvas")).toBeNull();
    });

    it("self-grading is hidden while drawing and comes back with I can't draw (a misclick)", async () => {
        m.isDrawFirst.mockReturnValue(false);
        render(<ReviewFlashCard cards={[call(40)]} />);
        await userEvent.click(screen.getByText("Click to reveal"));
        expect(screen.getByRole("button", { name: /Good/ })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Practice" }));
        expect(screen.getByTestId("canvas")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Good/ })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "I can't draw" }));
        expect(screen.getByRole("button", { name: /Good/ })).toBeInTheDocument();
    });

    it("the Practice button sits in the same row as Edit and Delete, not on a row of its own", () => {
        m.isDrawFirst.mockReturnValue(false);
        render(<ReviewFlashCard cards={[call(40)]} />);
        const practice = screen.getByRole("button", { name: "Practice" });
        const del = screen.getByRole("button", { name: /Delete/ });
        expect(practice.parentElement).toContainElement(del);       // [Practice] ... [Edit Delete] in one flex row
        expect(practice.parentElement).toHaveClass("flex");
    });

    it("no stroke data falls back to the flip card", async () => {
        m.loadStrokeData.mockResolvedValue(null);
        render(<ReviewFlashCard cards={[call(40)]} />);
        await vi.waitFor(() => expect(screen.queryByTestId("canvas")).toBeNull());
    });

    it("a finished drawing is submitted with hintUsed true when a guide was shown", async () => {
        m.guidance = "guide";
        render(<ReviewFlashCard cards={[call(40)]} />);
        await m.onResult!({ similarity: 0.9, strokeOrderErrors: 0 });
        expect(m.submitCalligraphyDrawing).toHaveBeenCalledWith("call_1", 0.9, 0, expect.any(Number), true);
    });

    it("without a guide the drawing is submitted unhinted", async () => {
        render(<ReviewFlashCard cards={[call(40)]} />);
        await m.onResult!({ similarity: 0.9, strokeOrderErrors: 0 });
        expect(m.submitCalligraphyDrawing).toHaveBeenCalledWith("call_1", 0.9, 0, expect.any(Number), false);
    });
});
