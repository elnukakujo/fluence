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
vi.mock("./calligraphyPracticeCanvas", () => ({
    default: (p: { onResult: typeof m.onResult }) => { m.onResult = p.onResult; return <div data-testid="canvas" />; },
    guidanceFor: () => m.guidance,
}));

import ReviewFlashCard from "./reviewFlashCard";

const call = (score: number) => ({ id: "call_1", created_at: "2026-01-01T00:00:00", score, difficulty: 0.5, character: { character: "日", phonetic: "rì", strokes: 4 } }) as unknown as ReviewCard;

beforeEach(() => { vi.clearAllMocks(); m.loadStrokeData.mockResolvedValue([[]]); m.isDrawFirst.mockReturnValue(true); m.guidance = "none"; });

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
