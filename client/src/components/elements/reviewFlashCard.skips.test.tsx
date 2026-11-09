// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/process", () => api);
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: ({ exercise, onFinished, gaveUp }: { exercise: { id: string }; onFinished?: () => void; gaveUp?: boolean }) => <div><span data-testid="runner">{exercise.id}</span>{gaveUp && <span>answer shown</span>}<button onClick={onFinished}>solve</button></div> }));
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

    it("swaps an exercise the learner can't do for a ready spare, keeping the queue length", async () => {
        const spare = { ...ex("ex_s", "translate"), spare: true } as unknown as ReviewCard;
        render(<ReviewFlashCard cards={[ex("ex_1", "dictation"), ex("ex_2", "essay"), spare]} />);
        await userEvent.click(screen.getByRole("button", { name: "I can't hear" }));
        expect(screen.getByTestId("runner")).toHaveTextContent("ex_s");
        expect(screen.getByText(/1 \/ 2|1\/2/)).toBeInTheDocument();
        expect(api.updateScoreById).not.toHaveBeenCalled();
    });

    it("uses a spare only once and never one the learner can't do", async () => {
        const spares = [{ ...ex("ex_d", "dictation"), spare: true }, { ...ex("ex_s", "translate"), spare: true }] as unknown as ReviewCard[];
        render(<ReviewFlashCard cards={[ex("ex_1", "dictation"), ex("ex_2", "dictation"), ...spares]} />);
        await userEvent.click(screen.getByRole("button", { name: "I can't hear" }));
        expect(screen.getByTestId("runner")).toHaveTextContent("ex_s");
        await userEvent.click(screen.getByRole("button", { name: "solve" }));
        await userEvent.click(screen.getByRole("button", { name: "Next Exercise" }));
        await userEvent.click(screen.getByRole("button", { name: "I can't hear" }));
        expect(screen.queryByTestId("runner")).toBeNull();      // no usable spare left: skipped as before
    });

    it("Next is hidden until the exercise is finished", async () => {
        render(<ReviewFlashCard cards={[ex("ex_1", "essay"), ex("ex_2", "essay")]} />);
        expect(screen.queryByRole("button", { name: "Next Exercise" })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "solve" }));
        expect(screen.queryByRole("button", { name: "I don't know" })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "Next Exercise" }));
        expect(screen.getByTestId("runner")).toHaveTextContent("ex_2");
    });

    it("I don't know reveals the answer and offers Next instead of advancing", async () => {
        render(<ReviewFlashCard cards={[ex("ex_1", "essay"), ex("ex_2", "essay")]} />);
        await userEvent.click(screen.getByRole("button", { name: "I don't know" }));
        expect(screen.getByTestId("runner")).toHaveTextContent("ex_1");
        expect(screen.getByText("answer shown")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Next Exercise" })).toBeInTheDocument();
    });

    it("the section total does not count the spares", () => {
        const sec = (id: string, spare = false) => ({ ...ex(id, "essay"), section: "ex", spare }) as unknown as ReviewCard;
        render(<ReviewFlashCard cards={[sec("ex_1"), sec("ex_2"), sec("ex_s1", true), sec("ex_s2", true), sec("ex_s3", true)]} />);
        expect(screen.getByText((_, el) => /^0 \/ \d+ \S+/.test(el?.textContent ?? "") && el?.className.includes("whitespace-nowrap") === true)).toHaveTextContent(/^0 \/ 2 /);      // 2 queued exercises, not 5
    });
});
