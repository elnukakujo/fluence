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
    it("skips a speaking exercise without scoring it, and gets it back when un-skipped", async () => {
        render(<ReviewFlashCard cards={[ex("ex_1", "speaking"), ex("ex_2", "essay")]} />);
        expect(screen.getByTestId("runner")).toHaveTextContent("ex_1");
        const speak = screen.getByRole("button", { name: "I can't speak" });
        await userEvent.click(speak);
        expect(screen.getByTestId("runner")).toHaveTextContent("ex_2");
        expect(screen.getByRole("status")).toHaveTextContent("1 exercise skipped");
        expect(api.updateScoreById).not.toHaveBeenCalled();
        await userEvent.click(speak);
        expect(screen.getByTestId("runner")).toHaveTextContent("ex_1");
    });

    it("lets the user turn a skip off even when everything was skipped", async () => {
        render(<ReviewFlashCard cards={[ex("ex_1", "speaking")]} />);
        await userEvent.click(screen.getByRole("button", { name: "I can't speak" }));
        expect(screen.queryByTestId("runner")).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "I can't speak" }));
        expect(screen.getByTestId("runner")).toHaveTextContent("ex_1");
    });
});
