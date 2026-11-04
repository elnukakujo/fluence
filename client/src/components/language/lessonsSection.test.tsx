// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Lesson from "@/interface/containers/Lesson";

const api = vi.hoisted(() => ({ reorderLessons: vi.fn(), bulkDeleteLessons: vi.fn(), getAllLessons: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/api/lesson", () => api);
vi.mock("next/navigation", () => ({
  useParams: () => ({ language_id: "lang1" }),
  useRouter: () => nav,
}));

import LessonsSection from "./lessonsSection";

const lesson = (id: string, title: string, extra: Record<string, unknown> = {}) =>
  ({ id, title, level: 0, score: 0, description: "", vocabulary: ["v1", "v2"], grammar: [], calligraphy: [], exercise_ids: [], ...extra }) as unknown as Lesson;
const lessons = [lesson("lesson_1", "Alpha"), lesson("lesson_2", "Beta"), lesson("lesson_3", "Gamma"), lesson("lesson_s", "Shared one", { shared: true })];

const renderIt = (canManage = true) => render(<LessonsSection lessons={lessons} language_code="jpn" languageId="lang1" canManage={canManage} />);
const manage = async () => userEvent.click(screen.getByRole("button", { name: "Select" }));

beforeEach(() => { vi.clearAllMocks(); api.reorderLessons.mockResolvedValue(undefined); api.bulkDeleteLessons.mockResolvedValue({ deleted: 1 }); });

describe("manage mode", () => {
  it("is not offered to someone who cannot manage the language", () => {
    renderIt(false);
    expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
  });

  it("shows a checkbox and up/down buttons per owned lesson, disabled at the ends, and nothing for shared lessons", async () => {
    renderIt();
    await manage();
    expect(screen.getByRole("checkbox", { name: "Select Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Alpha up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Alpha down" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Gamma down" })).toBeDisabled();
    expect(screen.queryByRole("checkbox", { name: "Select Shared one" })).not.toBeInTheDocument();
  });

  it("saves the new order, announces it and keeps focus on the pressed button", async () => {
    renderIt();
    await manage();
    await userEvent.click(screen.getByRole("button", { name: "Move Alpha down" }));
    expect(api.reorderLessons).toHaveBeenCalledWith("lang1", ["lesson_2", "lesson_1", "lesson_3"]);
    expect(await screen.findByText("Moved Alpha to position 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Alpha down" })).toHaveFocus();
    const rows = screen.getAllByRole("listitem").map((r) => within(r).queryByRole("checkbox")?.getAttribute("aria-label"));
    expect(rows.slice(0, 3)).toEqual(["Select Beta", "Select Alpha", "Select Gamma"]);
  });

  it("reloads the server data after a saved reorder, so the lesson grid shows the new order", async () => {
    renderIt();
    await manage();
    await userEvent.click(screen.getByRole("button", { name: "Move Alpha down" }));
    await screen.findByText("Moved Alpha to position 2");
    expect(nav.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not reload when saving the order fails", async () => {
    api.reorderLessons.mockRejectedValue(new Error("nope"));
    renderIt();
    await manage();
    await userEvent.click(screen.getByRole("button", { name: "Move Alpha down" }));
    await screen.findByRole("alert");
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("puts the order back and says so when saving fails", async () => {
    api.reorderLessons.mockRejectedValue(new Error("nope"));
    renderIt();
    await manage();
    await userEvent.click(screen.getByRole("button", { name: "Move Alpha down" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save the new order");
    const rows = screen.getAllByRole("listitem").map((r) => within(r).queryByRole("checkbox")?.getAttribute("aria-label"));
    expect(rows.slice(0, 3)).toEqual(["Select Alpha", "Select Beta", "Select Gamma"]);
  });

  it("shows the action bar once something is selected; Merge is enabled for exactly two", async () => {
    renderIt();
    await manage();
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Gamma" }));
    expect(screen.getByRole("button", { name: "Merge" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(nav.push).toHaveBeenCalledWith("/languages/lang1/merge?a=lesson_1&b=lesson_3");
  });

  it("confirms before deleting, lists titles with item counts, and deletes the selection", async () => {
    renderIt();
    await manage();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Beta" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Alpha · Beta/)).toBeInTheDocument();
    expect(api.bulkDeleteLessons).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete 2 lessons" }));
    expect(api.bulkDeleteLessons).toHaveBeenCalledWith(["lesson_1", "lesson_2"]);
    expect(await screen.findByText("Deleted 2 lessons")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select Alpha" })).not.toBeInTheDocument();
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("cancelling the dialog deletes nothing", async () => {
    renderIt();
    await manage();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.bulkDeleteLessons).not.toHaveBeenCalled();
  });

  it("hides reordering while a search is active", async () => {
    renderIt();
    await manage();
    await userEvent.type(screen.getByRole("searchbox"), "Al");
    expect(screen.queryByRole("button", { name: "Move Alpha down" })).not.toBeInTheDocument();
    expect(screen.getByText("Clear the search and filters to reorder lessons.")).toBeInTheDocument();
  });
});
