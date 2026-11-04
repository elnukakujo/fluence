// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";

const api = vi.hoisted(() => ({ createExercise: vi.fn(), updateExercise: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/exercise", () => api);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/tags/tagSelector", () => ({ default: () => null }));
vi.mock("@/components/sources/sourceSelector", () => ({ default: () => null }));
vi.mock("@/components/media/mediaLoader", () => ({ default: () => null }));
vi.mock("@/components/ui/selectMenu/openCloseMenu", () => ({ default: () => null }));

import ExerciseForm from "./exerciseForm";

const elements = { vocabularies: [], grammars: [], calligraphies: [] } as never;
const form = (exercise: Partial<Exercise>) => render(<ExerciseForm exercise={exercise} lesson_id="lesson_1" lessonElements={elements} />);

beforeEach(() => vi.clearAllMocks());

describe("exercise form: reading and dictation", () => {
  it("updates a reading: keeps each line's audioIndex and stores the joined lines as the answer", async () => {
    form({ id: "ex_1", exercise_type: "reading", question: "Read", answer: "a\nb", lesson_id: "lesson_1",
      content: { speakers: [{ id: "s1", name: "A" }, { id: "s2", name: "B" }],
                 lines: [{ speakerId: "s1", text: "a", translation: null, audioIndex: 0 }, { speakerId: "s2", text: "b", translation: "bee", audioIndex: null }] } });
    const texts = screen.getAllByPlaceholderText("Line text…");
    expect(texts).toHaveLength(2);
    await userEvent.clear(texts[1]);
    await userEvent.type(texts[1], "c");
    await userEvent.click(screen.getByRole("button", { name: "Update Exercise" }));
    const sent = api.updateExercise.mock.calls[0][1];
    expect(sent.answer).toBe("a\nc");
    expect(sent.content.speakers).toHaveLength(2);
    expect(sent.content.lines.map((l: { audioIndex: number | null }) => l.audioIndex)).toEqual([0, null]);
  });

  it("creates dictation content and a space-joined answer from its rows", async () => {
    form({ id: "ex_2", exercise_type: "dictation", question: "Write", answer: "x y", lesson_id: "lesson_1",
      content: { lines: [{ text: "x", audioIndex: null }, { text: "y", audioIndex: 1 }] } });
    await userEvent.click(screen.getByRole("button", { name: "Update Exercise" }));
    const sent = api.updateExercise.mock.calls[0][1];
    expect(sent.answer).toBe("x y");
    expect(sent.content).toEqual({ lines: [{ text: "x", audioIndex: null }, { text: "y", audioIndex: 1 }] });
  });
});
