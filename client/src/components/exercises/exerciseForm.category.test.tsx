// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";

const api = vi.hoisted(() => ({ createExercise: vi.fn().mockResolvedValue({ id: "ex_9" }), updateExercise: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/exercise", () => api);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/tags/tagSelector", () => ({ default: () => null }));
vi.mock("@/components/sources/sourceSelector", () => ({ default: () => null }));
vi.mock("@/components/media/mediaLoader", () => ({ default: () => <div data-testid="media" /> }));
vi.mock("@/components/ui/selectMenu/openCloseMenu", () => ({ default: () => null }));

import ExerciseForm from "./exerciseForm";

const elements = { vocabularies: [], grammars: [], calligraphies: [] };
const form = (iso: string, exercise?: Partial<Exercise>) =>
  render(<ExerciseForm languageIso={iso} lesson_id="lesson_1" lessonElements={elements} exercise={exercise} />);
const select = () => screen.getByLabelText("Exam section") as HTMLSelectElement;

beforeEach(() => vi.clearAllMocks());

describe("exercise form: exam category", () => {
  it("offers the language's exam sections plus None", () => {
    form("jpn", { id: "ex_1", exercise_type: "essay", question: "q", answer: "a", lesson_id: "lesson_1" });
    expect([...select().options].map((o) => o.value)).toEqual(["", "language_knowledge", "reading", "listening"]);
  });

  it("sends the chosen category, and null for None", async () => {
    form("fra", { id: "ex_1", exercise_type: "essay", question: "q", answer: "a", lesson_id: "lesson_1", category: "reading" });
    expect(select().value).toBe("reading");
    await userEvent.selectOptions(select(), "writing");
    await userEvent.click(screen.getByRole("button", { name: "Update Exercise" }));
    expect(api.updateExercise.mock.calls[0][1].category).toBe("writing");
    await userEvent.selectOptions(select(), "");
    await userEvent.click(screen.getByRole("button", { name: "Update Exercise" }));
    expect(api.updateExercise.mock.calls[1][1].category).toBeNull();
  });

  it("keeps a stored slug the exam no longer has as a selectable option", () => {
    form("jpn", { id: "ex_1", exercise_type: "essay", question: "q", answer: "a", lesson_id: "lesson_1", category: "old-slug" });
    expect(select().value).toBe("old-slug");
  });

  it("preselects a suggestion for a new dictation in Japanese, until the user picks one", async () => {
    form("jpn");
    await userEvent.click(screen.getAllByRole("textbox")[0]);   // opens the type menu
    await userEvent.click(screen.getByText("Dictation"));
    expect(select().value).toBe("listening");
  });
});
