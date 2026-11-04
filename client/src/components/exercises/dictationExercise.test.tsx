// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}), evaluateText: vi.fn() }));
const exApi = vi.hoisted(() => ({ generateLineAudio: vi.fn() }));
const played = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock("@/api/process", () => api);
vi.mock("@/api/exercise", () => exApi);

import DictationExercise from "./dictationExercise";

const ex = () => ({
  id: "ex_2", exercise_type: "dictation", question: "Write what you hear", answer: "犬がいます 猫もいます", audio_files: [],
  content: { lines: [{ text: "犬がいます", audioIndex: null }, { text: "猫もいます", audioIndex: null }] } }) as unknown as Exercise;

beforeEach(() => {
  vi.clearAllMocks();
  played.urls = [];
  vi.stubGlobal("Audio", class { constructor(url: string) { played.urls.push(url); } play() { return Promise.resolve(); } });
  api.evaluateText.mockResolvedValue({ correct: true, score: 0.9, feedback: "Good" });
});

describe("dictation exercise", () => {
  it("generates the line's clip with the user's TTS endpoint and plays it", async () => {
    exApi.generateLineAudio.mockResolvedValue({ audio_files: ["/media/audio/d.wav"], content: { lines: [{ audioIndex: 0 }, { audioIndex: null }] } });
    render(<DictationExercise exercise={ex()} />);
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(exApi.generateLineAudio).toHaveBeenCalledWith("ex_2", 0);
    expect(played.urls).toEqual(["/media/audio/d.wav"]);
  });

  it("does nothing, silently, when no TTS endpoint is configured", async () => {
    exApi.generateLineAudio.mockRejectedValue(new Error("tts_not_configured"));
    render(<DictationExercise exercise={ex()} />);
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(exApi.generateLineAudio).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(played.urls).toEqual([]);
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
