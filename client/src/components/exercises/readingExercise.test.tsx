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

import ReadingExercise from "./readingExercise";

const ex = (over: Partial<Exercise> = {}) => ({
  id: "ex_1", exercise_type: "reading", question: "Read the dialogue", answer: "こんにちは\nやあ", audio_files: [],
  content: { speakers: [{ id: "s1", name: "A" }, { id: "s2", name: "B" }],
             lines: [{ speakerId: "s1", text: "こんにちは", translation: "Hello", audioIndex: null },
                     { speakerId: "s2", text: "やあ", translation: null, audioIndex: 5 }] }, ...over }) as unknown as Exercise;

beforeEach(() => {
  vi.clearAllMocks();
  played.urls = [];
  vi.stubGlobal("Audio", class { constructor(url: string) { played.urls.push(url); } play() { return Promise.resolve(); } });
});

describe("reading exercise", () => {
  it("shows every line and hides the translation until asked", async () => {
    render(<ReadingExercise exercise={ex()} />);
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    expect(screen.getByText("やあ")).toBeInTheDocument();
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show translation" }));
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("plays a stored clip without calling the TTS endpoint", async () => {
    render(<ReadingExercise exercise={ex({ audio_files: ["/media/audio/a.wav"], content: { speakers: [{ id: "s1", name: "A" }], lines: [{ speakerId: "s1", text: "本文", translation: null, audioIndex: 0 }] } })} />);
    await userEvent.click(screen.getByRole("button", { name: "Play line 1" }));
    expect(played.urls).toEqual(["/media/audio/a.wav"]);
    expect(exApi.generateLineAudio).not.toHaveBeenCalled();
  });

  it("generates a missing clip with the user's TTS endpoint once, then replays it without asking again", async () => {
    exApi.generateLineAudio.mockResolvedValue({ audio_files: ["/media/audio/new.wav"], content: { lines: [{ audioIndex: 0 }, { audioIndex: null }] } });
    render(<ReadingExercise exercise={ex()} />);
    await userEvent.click(screen.getByRole("button", { name: "Play line 1" }));
    expect(exApi.generateLineAudio).toHaveBeenCalledWith("ex_1", 0);
    expect(played.urls).toEqual(["/media/audio/new.wav"]);
    await userEvent.click(screen.getByRole("button", { name: "Play line 1" }));
    expect(exApi.generateLineAudio).toHaveBeenCalledTimes(1);
    expect(played.urls).toHaveLength(2);
  });

  it("does nothing, silently, when no TTS endpoint is configured", async () => {
    exApi.generateLineAudio.mockRejectedValue(new Error("tts_not_configured"));
    render(<ReadingExercise exercise={ex()} />);
    await userEvent.click(screen.getByRole("button", { name: "Play line 1" }));
    expect(exApi.generateLineAudio).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(played.urls).toEqual([]);
  });

  it("warns that the endpoint failed on any other error", async () => {
    exApi.generateLineAudio.mockRejectedValue(new Error("tts_failed"));
    render(<ReadingExercise exercise={ex()} />);
    await userEvent.click(screen.getByRole("button", { name: "Play line 2" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/endpoint failed/);
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
