// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Language from "@/interface/containers/Language";

const api = vi.hoisted(() => ({ reorderLanguages: vi.fn(), bulkDeleteLanguages: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/api/language", () => api);
vi.mock("@/api/lesson", () => ({ getAllLessons: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({}), useRouter: () => nav }));

import LanguageGrid from "./languageGrid";

const lang = (id: string, name: string, user_id = "u1") => ({ id, name, alias: "", user_id, level: 0, score: 0, description: "", flag: "" }) as unknown as Language;
const languages = [lang("lang_1", "Japanese"), lang("lang_2", "Chinese"), lang("lang_3", "Korean", "other")];

beforeEach(() => { vi.clearAllMocks(); api.reorderLanguages.mockResolvedValue(undefined); api.bulkDeleteLanguages.mockResolvedValue({ deleted: 1 }); });

describe("home page language selection", () => {
  it("is not offered when the user owns none of the languages", () => {
    render(<LanguageGrid languages={[lang("lang_3", "Korean", "other")]} userId="u1" />);
    expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
  });

  it("reorders owned languages with the buttons and saves only the owned ids", async () => {
    render(<LanguageGrid languages={languages} userId="u1" />);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Japanese down" }));
    expect(api.reorderLanguages).toHaveBeenCalledWith(["lang_2", "lang_1"]);
    expect(screen.queryByRole("checkbox", { name: "Select Korean" })).not.toBeInTheDocument();
  });

  it("selects all, shows the shared action bar with tags / sources / delete, and deletes after confirming", async () => {
    render(<LanguageGrid languages={languages} userId="u1" />);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Select all/ }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tags" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sources" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete 2 languages" }));
    expect(api.bulkDeleteLanguages).toHaveBeenCalledWith(["lang_1", "lang_2"]);
  });

  it("reorders by dragging a row onto another", async () => {
    render(<LanguageGrid languages={languages} userId="u1" />);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    const rows = screen.getAllByRole("listitem");
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(rows[1], { dataTransfer });
    fireEvent.dragOver(rows[0], { dataTransfer });   // jsdom has no layout nor drag coordinates: that is the upper half of the row
    expect(rows[0].querySelector(".bg-primary.h-1")).not.toBeNull();   // the drop line shows where the row will land
    fireEvent.drop(rows[0], { dataTransfer });
    expect(document.querySelector(".bg-primary.h-1")).toBeNull();
    expect(dataTransfer.setData).toHaveBeenCalled();
    expect(api.reorderLanguages).toHaveBeenCalledWith(["lang_2", "lang_1"]);
  });

  it("puts the action bar out of the page flow (fixed), so it never pushes the page down", async () => {
    render(<LanguageGrid languages={languages} userId="u1" />);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Japanese" }));
    expect(screen.getByRole("region", { name: "Actions for the selected items" }).parentElement?.parentElement).toHaveClass("fixed");
  });
});
