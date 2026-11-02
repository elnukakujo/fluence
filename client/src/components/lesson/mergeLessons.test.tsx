// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Lesson from "@/interface/containers/Lesson";

const api = vi.hoisted(() => ({ mergeLessons: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/api/lesson", () => api);
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

import MergeLessons from "./mergeLessons";

const lesson = (id: string, title: string, level: number, description: string, vocab: number) =>
  ({ id, title, level, description, vocabulary: Array(vocab).fill("v"), grammar: [], calligraphy: [], exercise_ids: ["e"] }) as unknown as Lesson;
const a = lesson("lesson_a", "Alpha", 1, "About alpha", 2);
const b = lesson("lesson_b", "Beta", 3, "About beta", 4);
const renderIt = () => render(<MergeLessons languageId="lang1" a={a} b={b} levelOptions={["A1", "A2", "B1", "B2"]} />);

beforeEach(() => { vi.clearAllMocks(); api.mergeLessons.mockResolvedValue({ id: "lesson_a" }); });

describe("MergeLessons", () => {
  it("shows both lessons read-only with their level and item counts", () => {
    renderIt();
    expect(screen.getByRole("region", { name: "Lesson A: Alpha" })).toHaveTextContent("About alpha");
    expect(screen.getByRole("region", { name: "Lesson B: Beta" })).toHaveTextContent("5 items");
    expect(screen.getByRole("region", { name: "Lesson A: Alpha" })).toHaveTextContent("A2");
  });

  it("starts from 'A + B', A's description and the higher level", () => {
    renderIt();
    expect(screen.getByLabelText("Title")).toHaveValue("Alpha + Beta");
    expect(screen.getByLabelText("Description")).toHaveValue("About alpha");
    expect(screen.getByLabelText("Level")).toHaveValue("3");
  });

  it("copies a field from either lesson", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Use A's title" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Alpha");
    await userEvent.click(screen.getByRole("button", { name: "Use B's description" }));
    expect(screen.getByLabelText("Description")).toHaveValue("About beta");
    await userEvent.click(screen.getByRole("button", { name: "Use A's level" }));
    expect(screen.getByLabelText("Level")).toHaveValue("1");
  });

  it("says what will happen", () => {
    renderIt();
    expect(screen.getByText(/5 items move into this lesson/)).toBeInTheDocument();
    expect(screen.getByText(/“Beta” is deleted/)).toBeInTheDocument();
  });

  it("cannot be confirmed without a title", async () => {
    renderIt();
    await userEvent.clear(screen.getByLabelText("Title"));
    expect(screen.getByRole("button", { name: "Merge lessons" })).toBeDisabled();
  });

  it("merges into A with the edited fields and opens the merged lesson", async () => {
    renderIt();
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Combined");
    await userEvent.click(screen.getByRole("button", { name: "Merge lessons" }));
    expect(api.mergeLessons).toHaveBeenCalledWith({ first_id: "lesson_a", second_id: "lesson_b", title: "Combined", description: "About alpha", level: 3 });
    expect(nav.push).toHaveBeenCalledWith("/languages/lang1/lesson/lesson_a");
  });

  it("shows the server's reason and stays when the merge fails", async () => {
    api.mergeLessons.mockRejectedValue(new Error("Nope"));
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Merge lessons" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("cancel returns to the language page", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(nav.push).toHaveBeenCalledWith("/languages/lang1");
  });
});
