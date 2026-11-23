// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/api/ingestion", () => ({ pageImageUrl: () => "/x.png", mergeGrammar: vi.fn(), regenerateGrammar: vi.fn(), mergeExercises: vi.fn(), regenerateExercise: vi.fn() }));
vi.mock("@/api/vocabulary", () => ({ getVocabularyByLesson: vi.fn().mockResolvedValue([]) }));
vi.mock("@/api/grammar", () => ({ getGrammarByLesson: vi.fn().mockResolvedValue([]) }));
vi.mock("@/api/calligraphy", () => ({ getCalligraphyByLesson: vi.fn().mockResolvedValue([]) }));
vi.mock("@/api/exercise", () => ({
  getExercisesByLesson: vi.fn().mockResolvedValue([{ id: "ex_1", lesson_id: "lesson_1", exercise_type: "essay", question: "Write about it", answer: "An answer", review_reason: "too hard" }]),
  updateExercise: vi.fn(), deleteExercise: vi.fn(), redoExercise: vi.fn(),
}));

import ReviewPanel from "./reviewPanel";
import GenerationReview from "@/components/exercises/generationReview";
import type { Candidate } from "@/lib/ingestion/review";

const parsed: Candidate = { id: "e1", kind: "exercise", exercise_type: "essay", question: "Write about it", answer: "An answer", quote: "Write about it", page: 0, chunk_id: "c", status: "flagged", flags: [], min_conf: null };

// What the user meets on one exercise card, in both reviews: the same type menu, refresh button and Confirm / Edit / Delete, looking the same.
const CONTROLS = ["Redo", "Confirm", "Edit", "Delete"];
const classOf = (card: HTMLElement, name: string) => within(card).getByRole("button", { name }).className;

describe("one exercise review card for parsed and generated exercises", () => {
  it("offers the same controls, with the same look", async () => {
    const a = render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[parsed]} addLabel={(n) => `Add ${n}`} onAdd={vi.fn()} />);
    const parsedCard = a.container.querySelector("li.review-card") as HTMLElement;
    const parsedClasses = Object.fromEntries(CONTROLS.map((n) => [n, within(parsedCard).queryByRole("button", { name: n })?.className ?? null]));
    expect(within(parsedCard).queryByLabelText("Change type")).not.toBeNull();
    a.unmount();

    render(<GenerationReview lessonId="lesson_1" onClose={vi.fn()} />);
    await screen.findByText("too hard");
    const generatedCard = document.querySelector("li.review-card") as HTMLElement;
    expect(within(generatedCard).queryByLabelText("Change type")).not.toBeNull();        // the same type menu: changing it rebuilds the exercise
    for (const name of CONTROLS) {
      expect(within(generatedCard).queryByRole("button", { name }), name).not.toBeNull();
      expect(parsedClasses[name], name).not.toBeNull();
      expect(classOf(generatedCard, name), name).toBe(parsedClasses[name]);
    }
  });

  it("has the same icon button for the rebuild form, 44 px, announcing whether the form is open", async () => {
    render(<GenerationReview lessonId="lesson_1" onClose={vi.fn()} />);
    await screen.findByText("too hard");
    const refresh = screen.getByRole("button", { name: "Redo" });
    expect(refresh).toHaveClass("h-11", "w-11");
    expect(refresh).toHaveAttribute("aria-expanded", "false");
  });
});
