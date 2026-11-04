// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}), evaluateText: vi.fn() }));
const speech = vi.hoisted(() => ({ speak: vi.fn().mockReturnValue(true) }));
vi.mock("@/api/process", () => api);
vi.mock("@/utils/speech", () => speech);

import DictationExercise from "./dictationExercise";

const ex = () => ({
  id: "ex_2", exercise_type: "dictation", question: "Write what you hear", answer: "犬がいます 猫もいます", audio_files: [],
  content: { lines: [{ text: "犬がいます", audioIndex: null }, { text: "猫もいます", audioIndex: null }] } }) as unknown as Exercise;

beforeEach(() => { vi.clearAllMocks(); api.evaluateText.mockResolvedValue({ correct: true, score: 0.9, feedback: "Good" }); });

describe("dictation exercise", () => {
  it("plays the line with the browser voice when there is no clip", async () => {
    render(<DictationExercise exercise={ex()} lang="ja" />);
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(speech.speak).toHaveBeenCalledWith("犬がいます", "ja");
  });

  it("evaluates once, after the last line, with the lines joined", async () => {
    render(<DictationExercise exercise={ex()} />);
    await userEvent.type(screen.getByRole("textbox"), "犬がいます");
    await userEvent.click(screen.getByRole("button", { name: "Next line" }));
    expect(api.evaluateText).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole("textbox"), "猫もいます");
    await userEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(api.evaluateText).toHaveBeenCalledTimes(1);
    expect(api.evaluateText).toHaveBeenCalledWith("ex_2", "犬がいます 猫もいます");
    expect(await screen.findByText("Good")).toBeInTheDocument();
    expect(api.updateScoreById).toHaveBeenCalledWith("ex_2", 0.9, expect.any(Number), false, 1);
  });

  it("scores 0 without calling the server when every line is empty", async () => {
    render(<DictationExercise exercise={ex()} />);
    await userEvent.click(screen.getByRole("button", { name: "Next line" }));
    await userEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(api.evaluateText).not.toHaveBeenCalled();
    expect(api.updateScoreById).toHaveBeenCalledWith("ex_2", 0, expect.any(Number), false, 1);
  });
});
