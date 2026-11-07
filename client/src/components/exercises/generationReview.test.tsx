// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getExercisesByLesson: vi.fn(), updateExercise: vi.fn().mockResolvedValue({}), deleteExercise: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/api/exercise", () => api);
const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

import GenerationBanner from "./generationBanner";
import GenerationReview from "./generationReview";

const ex = (id: string, extra = {}) => ({ id, lesson_id: "lesson_1", exercise_type: "essay", question: `Question ${id}`, answer: `Answer ${id}`, text_support: null, content: null, ...extra });
const FLAGGED = [ex("ex_1", { review_reason: "answer is wrong" }), ex("ex_2", { review_reason: "too hard" })];

beforeEach(() => {
  vi.clearAllMocks();
  api.getExercisesByLesson.mockResolvedValue([...FLAGGED, ex("ex_ok")]);
});

describe("generated exercises review", () => {
  it("lists only the exercises waiting for review, each with its reason", async () => {
    render(<GenerationReview lessonId="lesson_1" onClose={vi.fn()} />);
    expect(await screen.findByText("answer is wrong")).toBeInTheDocument();
    expect(screen.getByText("too hard")).toBeInTheDocument();
    expect(screen.queryByText("Question ex_ok")).toBeNull();
  });

  it("shows each question once", async () => {
    render(<GenerationReview lessonId="lesson_1" onClose={vi.fn()} />);
    await screen.findByText("answer is wrong");
    expect(screen.getAllByText("Question ex_1")).toHaveLength(1);
  });

  it("accept clears the reason (and nothing else changes) and removes the card", async () => {
    render(<GenerationReview lessonId="lesson_1" onClose={vi.fn()} />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Accept" }))[0]);
    expect(api.updateExercise).toHaveBeenCalledWith("ex_1", expect.objectContaining({ review_reason: null, question: "Question ex_1", answer: "Answer ex_1", exercise_type: "essay" }));
    await waitFor(() => expect(screen.queryByText("answer is wrong")).toBeNull());
    expect(screen.getByText("too hard")).toBeInTheDocument();
  });

  it("delete removes the exercise", async () => {
    render(<GenerationReview lessonId="lesson_1" onClose={vi.fn()} />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Delete" }))[1]);
    expect(api.deleteExercise).toHaveBeenCalledWith("ex_2");
    await waitFor(() => expect(screen.queryByText("too hard")).toBeNull());
  });

  it("accept all accepts every flagged exercise and closes when none is left", async () => {
    const onClose = vi.fn();
    render(<GenerationReview lessonId="lesson_1" onClose={onClose} />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept all" }));
    await waitFor(() => expect(api.updateExercise).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("delete all removes every flagged exercise", async () => {
    render(<GenerationReview lessonId="lesson_1" onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete all" }));
    await waitFor(() => expect(api.deleteExercise).toHaveBeenCalledTimes(2));
  });

  it("an edit is what gets accepted", async () => {
    api.getExercisesByLesson.mockResolvedValue([ex("ex_q", { review_reason: "check", exercise_type: "quizz", content: { options: ["a", "b"], correct: [0] }, answer: "a" })]);
    render(<GenerationReview lessonId="lesson_1" onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getAllByRole("checkbox")[1]);        // the second option becomes a correct one too
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    const sent = api.updateExercise.mock.calls[0][1];
    expect(sent.content.correct).toEqual([0, 1]);
    expect(sent.review_reason).toBeNull();
  });
});

describe("generation banner", () => {
  it("shows nothing when no exercise waits", () => {
    const { container } = render(<GenerationBanner lessonId="lesson_1" count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces the count and opens the review", async () => {
    render(<GenerationBanner lessonId="lesson_1" count={2} />);
    await userEvent.click(screen.getByRole("button", { name: /2 generated exercises need a look/i }));
    expect(await screen.findByText("answer is wrong")).toBeInTheDocument();
  });
});
