// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import CustomReviewPicker from "./customReviewPicker";
import ByTypeRedirect from "@/app/languages/[language_id]/review/by-type/page";
import { redirect } from "next/navigation";

const sources = [{ id: "src_1", label: "Genki" }];
const tags = [{ id: "tag_1", label: "travel", color: "#ff0000" }];
const picker = (over: Partial<Parameters<typeof CustomReviewPicker>[0]> = {}) =>
  render(<CustomReviewPicker languageId="lang_1" types={["vocabulary", "grammar", "calligraphy", "exercise"]} sources={sources} tags={tags} {...over} />);

describe("custom review picker", () => {
  it("starts on the type tab and links each type to its queue", () => {
    picker();
    expect(screen.getByRole("tab", { name: "Type" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Grammar" })).toHaveAttribute("href", "/languages/lang_1/review/queue?scope=type&type=grammar");
    expect(screen.getByRole("link", { name: "Exercises" })).toHaveAttribute("href", "/languages/lang_1/review/queue?scope=type&type=exercise");
  });

  it("lists sources then tags on their tabs, each with its own scope", async () => {
    picker();
    await userEvent.click(screen.getByRole("tab", { name: "Source" }));
    expect(screen.getByRole("link", { name: "Genki" })).toHaveAttribute("href", "/languages/lang_1/review/queue?scope=source&source_id=src_1");
    expect(screen.queryByRole("link", { name: "Grammar" })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Tag" }));
    expect(screen.getByRole("link", { name: "travel" })).toHaveAttribute("href", "/languages/lang_1/review/queue?scope=tag&tag_id=tag_1");
  });

  it("moves between tabs with the arrow keys, wrapping, focus following", async () => {
    picker();
    screen.getByRole("tab", { name: "Type" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Source" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Type" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Tag" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Tag" })).toHaveAttribute("aria-selected", "true");
  });

  it("explains an empty tab", async () => {
    picker({ sources: [], tags: [] });
    await userEvent.click(screen.getByRole("tab", { name: "Tag" }));
    expect(screen.getByText(/no tag yet/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Source" }));
    expect(screen.getByText(/no source yet/i)).toBeInTheDocument();
  });

  it("offers only the types the course studies and never a component", () => {
    picker({ types: ["vocabulary"] });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /character|word|passage|radical/i })).toBeNull();
  });

  it("the old by-type page redirects to the custom review", async () => {
    await ByTypeRedirect({ params: Promise.resolve({ language_id: "lang_1" }) });
    expect(redirect).toHaveBeenCalledWith("/languages/lang_1/review/custom");
  });
});
