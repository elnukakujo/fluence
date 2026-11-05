// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/process", () => api);
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: ({ exercise }: { exercise: { id: string } }) => <div data-testid="runner">{exercise.id}</div> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/api/language", () => ({ getLanguageById: vi.fn().mockResolvedValue({ target_iso639_2t: "jpn" }) }));

import ReviewFlashCard from "./reviewFlashCard";

const ex = (id: string, exercise_type: string) => ({ id, exercise_type, question: "q", answer: "a", created_at: "2026-01-01T00:00:00" }) as unknown as ReviewCard;
beforeEach(() => vi.clearAllMocks());

describe("review: skips", () => {
    it("offers can't speak only on a speaking exercise; skipping it moves on without scoring", async () => {
        render(<ReviewFlashCard cards={[ex("ex_1", "speaking"), ex("ex_2", "essay")]} />);
        expect(screen.queryByRole("button", { name: "I can't hear" })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "I can't speak" }));
        expect(screen.getByTestId("runner")).toHaveTextContent("ex_2");
        expect(screen.queryByRole("button", { name: /I can't/ })).toBeNull();
        expect(api.updateScoreById).not.toHaveBeenCalled();
    });

    it("skipping the only exercise ends the review without scoring", async () => {
        render(<ReviewFlashCard cards={[ex("ex_1", "dictation")]} />);
        await userEvent.click(screen.getByRole("button", { name: "I can't hear" }));
        expect(screen.queryByTestId("runner")).toBeNull();
        expect(api.updateScoreById).not.toHaveBeenCalled();
    });
});
