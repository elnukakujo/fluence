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

import ReadingExercise from "./readingExercise";

const ex = (over: Partial<Exercise> = {}) => ({
  id: "ex_1", exercise_type: "reading", question: "Read the dialogue", answer: "こんにちは\nやあ", audio_files: [],
  content: { speakers: [{ id: "s1", name: "A" }, { id: "s2", name: "B" }],
             lines: [{ speakerId: "s1", text: "こんにちは", translation: "Hello", audioIndex: null },
                     { speakerId: "s2", text: "やあ", translation: null, audioIndex: 5 }] }, ...over }) as unknown as Exercise;

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("Audio", class { play() { return Promise.resolve(); } }); });

describe("reading exercise", () => {
  it("shows every line and hides the translation until asked", async () => {
    render(<ReadingExercise exercise={ex()} lang="ja" />);
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    expect(screen.getByText("やあ")).toBeInTheDocument();
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show translation" }));
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("speaks a line with no clip, and also when its audioIndex points past audio_files", async () => {
    render(<ReadingExercise exercise={ex()} lang="ja" />);
    await userEvent.click(screen.getByRole("button", { name: "Play line 1" }));
    expect(speech.speak).toHaveBeenLastCalledWith("こんにちは", "ja");
    await userEvent.click(screen.getByRole("button", { name: "Play line 2" }));
    expect(speech.speak).toHaveBeenLastCalledWith("やあ", "ja");
  });

  it("gives the point when the learner finishes, once, and offers no recording or self-grade", async () => {
    render(<ReadingExercise exercise={ex()} />);
    expect(screen.queryByText("rec")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Easy/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I've read it" }));
    expect(api.updateScoreById).toHaveBeenCalledWith("ex_1", 1, expect.any(Number), false, 1);
    expect(screen.queryByRole("button", { name: "I've read it" })).not.toBeInTheDocument();
    expect(api.updateScoreById).toHaveBeenCalledTimes(1);
  });

  it("renders a single-speaker passage", () => {
    render(<ReadingExercise exercise={ex({ content: { speakers: [{ id: "s1", name: "—" }], lines: [{ speakerId: "s1", text: "本文", translation: null, audioIndex: null }] } })} />);
    expect(screen.getByText("本文")).toBeInTheDocument();
  });
});
