// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/exercise", () => ({ createExercise: vi.fn(), updateExercise: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/tags/tagSelector", () => ({ default: () => null }));
vi.mock("@/components/sources/sourceSelector", () => ({ default: () => null }));
vi.mock("@/components/media/mediaLoader", () => ({ default: () => null }));
vi.mock("@/components/ui/selectMenu/openCloseMenu", () => ({ default: () => null }));

import ExerciseForm from "./exerciseForm";

const elements = { vocabularies: [], grammars: [], calligraphies: [] } as never;
const open = async (iso?: string) => {
  render(<ExerciseForm lesson_id="l1" lessonElements={elements} languageIso={iso} />);
  await userEvent.click(screen.getByRole("textbox", { name: /exercise type/i }));
};

describe("exercise form: type dropdown grouped by exam section", () => {
  it("lists the types under the exam's sections, in the exam's order", async () => {
    await open("fra");   // DELF: listening, reading, writing, speaking
    const groups = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(groups.slice(0, 4)).toEqual(["Listening comprehension", "Reading comprehension", "Writing", "Speaking"]);
    expect(within(screen.getByRole("group", { name: "Reading comprehension" })).getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("still offers every type exactly once", async () => {
    await open("jpn");   // JLPT has no writing section: its types must not vanish
    expect(screen.getAllByRole("option")).toHaveLength(13);
  });
});
