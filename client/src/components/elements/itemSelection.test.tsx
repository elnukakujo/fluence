// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";

const api = vi.hoisted(() => ({ bulkDeleteElements: vi.fn(), bulkMoveElements: vi.fn(), bulkEditTags: vi.fn(), bulkEditSources: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/api/element", () => api);
vi.mock("@/api/lesson", () => ({ getAllLessons: vi.fn().mockResolvedValue([{ id: "lesson_1", title: "Here" }, { id: "lesson_2", title: "There" }]) }));
vi.mock("@/api/tag", () => ({ getAllUserTags: vi.fn().mockResolvedValue([{ id: "tag_1", name: "food" }]) }));
vi.mock("@/api/source", () => ({ getAllUserSources: vi.fn().mockResolvedValue([]) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1", lesson_id: "lesson_1" }), useRouter: () => nav }));

import LessonItems, { SelectAllRow, SelectBox, SelectToggle } from "./itemSelection";
import VocabularyList from "./vocabularyList";
import GrammarList from "./grammarList";

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
    await userEvent.click(screen.getByRole("button", { name: "Leave selection" }));
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  it("select all ticks every row, shows the tri-state count, and a single untick makes it partial", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    const all = screen.getByRole("checkbox", { name: /Select all/ });
    await userEvent.click(all);
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /水/ }));
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect((all as HTMLInputElement).indeterminate).toBe(true);
    await userEvent.click(all);
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(all);
    expect(screen.queryByRole("region", { name: "Actions for the selected items" })).not.toBeInTheDocument();
  });

  it("deletes only after the confirmation, then shows a confirmation message and leaves select mode", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /水/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(api.bulkDeleteElements).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("cannot be undone");
    await userEvent.click(screen.getByRole("button", { name: "Delete 1 item" }));
    expect(api.bulkDeleteElements).toHaveBeenCalledWith(["voc_1"]);
    expect(nav.refresh).toHaveBeenCalled();
    expect(await screen.findByText("1 item deleted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
  });

  it("moves to a lesson picked from the list, leaving the current lesson out", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /水/ }));
    await userEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(await screen.findByRole("radio", { name: /There/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Here/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Move" })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: /There/ }));
    await userEvent.click(screen.getByRole("button", { name: "Move to There" }));
    expect(api.bulkMoveElements).toHaveBeenCalledWith(["voc_1"], "lesson_2");
  });

  it("tags cycle add -> remove -> leave, are summarised, and a server error stays in the dialog", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /水/ }));
    await userEvent.click(screen.getByRole("button", { name: "Tags" }));
    const chip = await screen.findByRole("button", { name: "food" });
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    await userEvent.click(chip);
    expect(screen.getByRole("button", { name: "food: add" })).toBeInTheDocument();
    expect(screen.getByText("Add 1 · remove 0")).toBeInTheDocument();
    api.bulkEditTags.mockRejectedValueOnce(new Error("Not yours"));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not yours");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(api.bulkEditTags).toHaveBeenLastCalledWith(["voc_1"], ["tag_1"], []);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
  });

  it("Escape leaves select mode", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("checkbox", { name: /水/ })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("checkbox", { name: /水/ })).not.toBeInTheDocument();
  });

  it("select mode is per list: ticking in vocabulary leaves grammar alone, and leaving one list drops only its ticks", async () => {
    render(
      <LessonItems isOwner userId="u1" lessonId="lesson_1" languageId="lang1">
        <VocabularyList vocProps={[voc("voc_1", "水")]} />
        <GrammarList gramProps={[{ id: "gram_1", title: "particle wa", score: 0, difficulty: 0 } as unknown as Grammar]} />
      </LessonItems>);
    const [selectVoc] = screen.getAllByRole("button", { name: "Select" });
    await userEvent.click(selectVoc);
    expect(screen.getByRole("checkbox", { name: /水/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /particle wa/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /水/ }));
    await userEvent.click(screen.getByRole("button", { name: "Select" }));   // grammar's (vocabulary's now says Done)
    await userEvent.click(screen.getByRole("checkbox", { name: /particle wa/ }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Done" })[0]);   // vocabulary's: leaves vocabulary only
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /水/ })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /particle wa/ })).toBeChecked();
  });
});

describe("select all inside a group", () => {
  it("ticks only the rows of that group", async () => {
    render(
      <LessonItems isOwner userId="u1" lessonId="lesson_1" languageId="lang1">
        <SelectToggle kind="ex" />
        <SelectAllRow kind="ex" suffix="A" entries={[["ex_1", "a1"], ["ex_2", "a2"]]} />
        <SelectBox kind="ex" id="ex_1" label="a1">a1</SelectBox><SelectBox kind="ex" id="ex_2" label="a2">a2</SelectBox>
        <SelectAllRow kind="ex" suffix="B" entries={[["ex_3", "b1"]]} />
        <SelectBox kind="ex" id="ex_3" label="b1">b1</SelectBox>
      </LessonItems>);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Select all · A/ }));
    expect(screen.getByRole("checkbox", { name: /a1/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /a2/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /b1/ })).not.toBeChecked();
  });
});
