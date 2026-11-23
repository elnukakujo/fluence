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
  const STATS = {
    vocabulary: { total: 400, seen: 100, mean_seen: 41.6, fading: 7, due: 30 },
    grammar: { total: 50, seen: 20, mean_seen: 55, fading: 0, due: 12 },
    calligraphy: { total: 80, seen: 10, mean_seen: 20, fading: 2, due: 5 },
    exercise: { total: 200, seen: null, mean_seen: null, fading: null, due: 9 },
  };

  it("starts on the type tab: one card per type with its figures, the one with most due selected, one start bar", () => {
    picker({ stats: STATS });
    expect(screen.getByRole("tab", { name: "Type" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: /Vocabulary/ })).toBeChecked();                 // 30 due, the most
    expect(screen.getByText("100 of 400 seen")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();                                      // average score, rounded
    expect(screen.getByRole("link", { name: /Review Vocabulary · 400 cards/ })).toHaveAttribute("href", "/languages/lang_1/review/queue?scope=type&type=vocabulary");
  });

  it("a vocabulary start bar says cards and words: 110 cards · 55 words", () => {
    picker({ stats: { ...STATS, vocabulary: { ...STATS.vocabulary, total: 55, cards: 110 } } });
    expect(screen.getByRole("link", { name: /Review Vocabulary · 110 cards · 55 words/ })).toBeInTheDocument();
  });

  it("choosing another type moves the start bar to it", async () => {
    picker({ stats: STATS });
    await userEvent.click(screen.getByRole("radio", { name: /Exercises/ }));
    expect(screen.getByRole("link", { name: /Review Exercises/ })).toHaveAttribute("href", "/languages/lang_1/review/queue?scope=type&type=exercise");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("still works without figures (they could not be fetched)", () => {
    picker();
    expect(screen.getByRole("link", { name: "Review Vocabulary" })).toHaveAttribute("href", "/languages/lang_1/review/queue?scope=type&type=vocabulary");
  });

  it("lists sources then tags on their tabs, each with its own scope", async () => {
    picker();
    await userEvent.click(screen.getByRole("tab", { name: "Source" }));
    expect(screen.getByRole("link", { name: "Genki" })).toHaveAttribute("href", "/languages/lang_1/review/queue?scope=source&source_id=src_1");
    expect(screen.queryByRole("radio")).toBeNull();
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
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.queryByRole("radio", { name: /character|word|passage|radical/i })).toBeNull();
  });

  it("the old by-type page redirects to the custom review", async () => {
    await ByTypeRedirect({ params: Promise.resolve({ language_id: "lang_1" }) });
    expect(redirect).toHaveBeenCalledWith("/languages/lang_1/review/custom");
  });
});
