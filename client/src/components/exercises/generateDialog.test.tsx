// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getExercisesByLesson: vi.fn().mockResolvedValue([{ id: "ex_f", lesson_id: "lesson_1", exercise_type: "essay", question: "Q", answer: "A", review_reason: "too hard" }]), suggestGeneration: vi.fn(), startGeneration: vi.fn(), getGeneration: vi.fn(), undoGenerationBatch: vi.fn() }));
vi.mock("@/api/exercise", () => api);
const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

import GenerateDialog from "./generateDialog";

const open = async () => { render(<GenerateDialog lessonId="lesson_1" />); await userEvent.click(screen.getByRole("button", { name: "Generate exercises" })); };
const tick = () => act(() => vi.advanceTimersByTimeAsync(2000));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  api.suggestGeneration.mockResolvedValue({ count: 12, mix: { essay: 7, quizz: 5 }, pool: 20 });
  api.startGeneration.mockResolvedValue("gen_1");
});
afterEach(() => vi.useRealTimers());

describe("generate exercises dialog", () => {
  it("defaults the count to the suggestion and previews the mix", async () => {
    await open();
    expect(await screen.findByLabelText("Number of exercises")).toHaveValue(12);
    expect(screen.getByText("Essay").closest("li")).toHaveTextContent("7");
    expect(screen.getByText("Quizz").closest("li")).toHaveTextContent("5");
  });

  it("re-plans the mix for the number typed in", async () => {
    await open();
    const field = await screen.findByLabelText("Number of exercises");
    api.suggestGeneration.mockResolvedValue({ count: 4, mix: { essay: 4 }, pool: 20 });
    await userEvent.clear(field);
    await userEvent.type(field, "4");
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(api.suggestGeneration).toHaveBeenLastCalledWith("lesson_1", 4);
    expect(screen.getByText("Essay").closest("li")).toHaveTextContent("4");
    expect(screen.queryByText("Quizz")).toBeNull();
  });

  it("cannot generate when nothing can be planned", async () => {
    api.suggestGeneration.mockResolvedValue({ count: 0, mix: {}, pool: 0 });
    await open();
    expect(await screen.findByText(/nothing to generate/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("offers to run in the background: closing keeps the job and does not stop polling the lesson", async () => {
    api.getGeneration.mockResolvedValue({ state: "running", done: 1, total: 12 });
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Generate" }));
    expect(screen.getByText(/keeps running/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Run in background" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("an error can be retried from the start", async () => {
    api.startGeneration.mockRejectedValueOnce(new Error("boom"));
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Generate" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Number of exercises")).toBeInTheDocument();
  });

  it("starts the job with the chosen count and shows the progress while polling", async () => {
    api.getGeneration.mockResolvedValueOnce({ state: "running", done: 3, total: 12 });
    await open();
    const count = await screen.findByLabelText("Number of exercises");
    await userEvent.clear(count);
    await userEvent.type(count, "9");
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(api.startGeneration).toHaveBeenCalledWith("lesson_1", 9);
    await tick();
    expect(await screen.findByRole("status")).toHaveTextContent("3 / 12");
  });

  it("explains a missing text endpoint", async () => {
    api.startGeneration.mockRejectedValue(new Error("text_gen_not_configured"));
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Generate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/text-generation endpoint/i);
  });

  it("says the job was lost when the server forgot it", async () => {
    api.getGeneration.mockRejectedValue(new Error("lost"));
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Generate" }));
    await tick();
    expect(await screen.findByRole("alert")).toHaveTextContent(/lost/i);
  });

  it("with nothing flagged shows the summary and undoes the batch", async () => {
    api.getGeneration.mockResolvedValue({ state: "done", done: 12, total: 12, result: { batch_id: "batch_1", saved: 12, flagged: [] } });
    api.undoGenerationBatch.mockResolvedValue({ deleted: 12 });
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Generate" }));
    await tick();
    expect(await screen.findByText("12 exercises saved.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(api.undoGenerationBatch).toHaveBeenCalledWith("batch_1");
  });

  it("opens the review of the flagged exercises by itself when the job finishes", async () => {
    api.getGeneration.mockResolvedValue({ state: "done", done: 12, total: 12, result: { batch_id: "batch_1", saved: 11, flagged: ["ex_f"] } });
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Generate" }));
    await tick();
    expect(await screen.findByText("too hard")).toBeInTheDocument();
  });
});
