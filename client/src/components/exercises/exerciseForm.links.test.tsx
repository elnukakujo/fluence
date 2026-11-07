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
vi.mock("@/components/media/mediaLoader", () => ({ default: () => <div data-testid="media" /> }));
vi.mock("@/components/ui/selectMenu/openCloseMenu", () => ({ default: () => null }));

import ExerciseForm from "./exerciseForm";

const elements = { vocabularies: [], grammars: [], calligraphies: [] } as never;
const base: Partial<Exercise> = { id: "ex_1", exercise_type: "essay", question: "q", answer: "a", lesson_id: "lesson_1" };
const form = (exercise: Partial<Exercise>) => render(<ExerciseForm exercise={exercise} lesson_id="lesson_1" lessonElements={elements} />);

beforeEach(() => vi.clearAllMocks());

describe("exercise form: mandatory links", () => {
  it("refuses to save without a linked element and says why", async () => {
    form(base);
    await userEvent.click(screen.getByRole("button", { name: "Update Exercise" }));
    expect(api.updateExercise).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Link the exercise to at least one");
  });

  it.each([["related_vocabulary"], ["related_grammar"], ["related_calligraphy"]])("saves when %s has an element", async (field) => {
    form({ ...base, [field]: ["x_1"] });
    await userEvent.click(screen.getByRole("button", { name: "Update Exercise" }));
    expect(api.updateExercise).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
