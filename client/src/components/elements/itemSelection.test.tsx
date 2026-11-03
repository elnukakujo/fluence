// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Vocabulary from "@/interface/features/Vocabulary";

const api = vi.hoisted(() => ({ bulkDeleteElements: vi.fn(), bulkMoveElements: vi.fn(), bulkEditTags: vi.fn(), bulkEditSources: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/api/element", () => api);
vi.mock("@/api/lesson", () => ({ getAllLessons: vi.fn().mockResolvedValue([{ id: "lesson_1", title: "Here" }, { id: "lesson_2", title: "There" }]) }));
vi.mock("@/api/tag", () => ({ getAllUserTags: vi.fn().mockResolvedValue([{ id: "tag_1", name: "food" }]) }));
vi.mock("@/api/source", () => ({ getAllUserSources: vi.fn().mockResolvedValue([]) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1", lesson_id: "lesson_1" }), useRouter: () => nav }));

import LessonItems from "./itemSelection";
import VocabularyList from "./vocabularyList";

const voc = (id: string, word: string) => ({ id, word: { word, translation: "x" }, score: 0, difficulty: 0 }) as unknown as Vocabulary;
const renderIt = (isOwner = true) => render(
  <LessonItems isOwner={isOwner} userId="u1" lessonId="lesson_1" languageId="lang1">
    <VocabularyList vocProps={[voc("voc_1", "水"), voc("voc_2", "火")]} />
  </LessonItems>);

beforeEach(() => { vi.clearAllMocks(); api.bulkDeleteElements.mockResolvedValue({ deleted: 2 }); api.bulkMoveElements.mockResolvedValue({ moved: 1, skipped: [] }); api.bulkEditTags.mockResolvedValue({ updated: 1 }); });

describe("lesson item selection", () => {
  it("is not offered to someone who does not own the lesson", () => {
    renderIt(false);
    expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
  });

  it("swaps the links for checkboxes, shows the bar with the count, and clears on Clear", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /水/ }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /火/ }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  it("deletes only after the confirmation", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /水/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(api.bulkDeleteElements).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    expect(api.bulkDeleteElements).toHaveBeenCalledWith(["voc_1"]);
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("moves to another lesson of the language, listing the current one out", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /水/ }));
    await userEvent.click(screen.getByRole("button", { name: "Move to…" }));
    expect(await screen.findByRole("option", { name: "There" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Here" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox"), "lesson_2");
    await userEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(api.bulkMoveElements).toHaveBeenCalledWith(["voc_1"], "lesson_2");
  });

  it("sends the tags to add and remove, and shows a server error inside the dialog", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /水/ }));
    await userEvent.click(screen.getByRole("button", { name: "Tags…" }));
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "food" }), "add");
    api.bulkEditTags.mockRejectedValueOnce(new Error("Not yours"));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not yours");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(api.bulkEditTags).toHaveBeenLastCalledWith(["voc_1"], ["tag_1"], []);
  });
});
