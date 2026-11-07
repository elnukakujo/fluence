// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ suggestGeneration: vi.fn(), startGeneration: vi.fn(), getGeneration: vi.fn(), undoGenerationBatch: vi.fn() }));
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
    expect(screen.getByText(/Essay/)).toHaveTextContent("7");
  });

  it("cannot generate when nothing can be planned", async () => {
    api.suggestGeneration.mockResolvedValue({ count: 0, mix: {}, pool: 0 });
    await open();
    expect(await screen.findByText(/nothing to generate/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
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
});
