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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import DictationExercise from "./dictationExercise";

const ex = () => ({
  id: "ex_2", exercise_type: "dictation", question: "Write what you hear", answer: "犬がいます 猫もいます", audio_files: ["/media/audio/d.wav", "/media/audio/e.wav"], needs: [],
  content: { lines: [{ text: "犬がいます", audioIndex: 0 }, { text: "猫もいます", audioIndex: 1 }] } }) as unknown as Exercise;

beforeEach(() => {
  vi.clearAllMocks();
  played.urls = [];
  vi.stubGlobal("Audio", class { constructor(url: string) { played.urls.push(url); } play() { return Promise.resolve(); } });
  api.evaluateText.mockResolvedValue({ correct: true, score: 0.9, feedback: "Good" });
});

describe("dictation exercise", () => {
  it("plays the line's stored clip", async () => {
    render(<DictationExercise exercise={ex()} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Play" }).at(-1)!);   // the media card has its own play buttons
    expect(played.urls).toContain("/media/audio/d.wav");
  });

  it("is not practicable while a line has no clip", () => {
    render(<DictationExercise exercise={{ ...ex(), needs: ["audio"], audio_files: [] } as Exercise} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/needs a clip for every line/)).toBeInTheDocument();
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
