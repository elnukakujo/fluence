// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/process", () => api);
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("./calligraphyPracticeCanvas", () => ({ default: () => <div data-testid="canvas" />, guidanceFor: () => "none" }));
vi.mock("@/lib/calligraphy/strokeData", () => ({ loadStrokeData: vi.fn().mockResolvedValue([[]]) }));
vi.mock("@/utils/drawFirst", () => ({ isDrawFirst: () => false }));

import ReviewFlashCard from "./reviewFlashCard";

export const voc = (score: number, difficulty = 0.5, extra: Record<string, unknown> = {}) => ({
    id: "voc_1", card_id: "voc_1#front", side: "front", created_at: "2026-01-01T00:00:00",
    word: { word: "猫", translation: "cat", phonetic: "māo" },
    example_sentences: [{ text: "猫在睡觉", translation: "The cat sleeps." }],
    front_score: score, front_difficulty: difficulty, back_score: score, back_difficulty: difficulty, score, difficulty, ...extra,
}) as unknown as ReviewCard;
export const call = (score: number, difficulty = 0.5) => ({
    id: "call_1", created_at: "2026-01-01T00:00:00", score, difficulty,
    character: { character: "日", phonetic: "rì", meaning: "sun", strokes: 4, radical: "日" },
}) as unknown as ReviewCard;

const front = () => within(screen.getByText("Click to reveal").closest('[role="button"]') as HTMLElement);   // the back face is always in the DOM (CSS flip)

beforeEach(() => vi.clearAllMocks());

describe("review card: tiers and fading scaffolds", () => {
    it("a learning vocabulary card shows its phonetic and an example up front, and names its tier", () => {
        render(<ReviewFlashCard cards={[voc(5)]} />);
        expect(front().getByText("/māo/")).toBeInTheDocument();
        expect(front().getByText("猫在睡觉")).toBeInTheDocument();
        expect(screen.getByText("Learning")).toBeInTheDocument();
    });

    it("a practising card hides the phonetic and has no Peek button", () => {
        render(<ReviewFlashCard cards={[voc(30)]} />);
        expect(screen.getByText("Practising")).toBeInTheDocument();
        expect(front().queryByText("/māo/")).toBeNull();
        expect(screen.queryByRole("button", { name: "Peek" })).toBeNull();
    });

    it("a maintaining card is bare", () => {
        render(<ReviewFlashCard cards={[voc(70, 0.4)]} />);
        expect(screen.getByText("Maintaining")).toBeInTheDocument();
        expect(front().queryByText("/māo/")).toBeNull();
        expect(front().queryByText("猫在睡觉")).toBeNull();
        expect(screen.queryByRole("button", { name: "Peek" })).toBeNull();
    });

    it("calligraphy shows phonetic and strokes only while learning", () => {
        const { unmount } = render(<ReviewFlashCard cards={[call(5)]} />);
        expect(front().getByText("/rì/")).toBeInTheDocument();
        unmount();
        render(<ReviewFlashCard cards={[call(40)]} />);
        expect(front().queryByText("/rì/")).toBeNull();
    });
});
