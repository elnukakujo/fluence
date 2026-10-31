// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PageKinds from "./pageKinds";

vi.mock("@/api/ingestion", () => ({ pageImageUrl: (j: string, p: number) => `/img/${j}/${p}.png` }));

describe("PageKinds", () => {
  it("reflects active kinds via aria-pressed and toggles one on click", async () => {
    const onChange = vi.fn();
    render(<PageKinds pages={[1, 2]} value={{ 1: ["vocabulary"], 2: ["grammar"] }} onChange={onChange} />);
    const [vocab1] = screen.getAllByRole("button", { name: "Vocabulary" });
    const [passage1] = screen.getAllByRole("button", { name: "Passage" });
    expect(vocab1).toHaveAttribute("aria-pressed", "true");
    expect(passage1).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(passage1);
    expect(onChange).toHaveBeenLastCalledWith({ 1: ["vocabulary", "passage"], 2: ["grammar"] });
    await userEvent.click(vocab1);
    expect(onChange).toHaveBeenLastCalledWith({ 1: [], 2: ["grammar"] });
  });

  it("shows the skipped text for an empty page, and lets the user re-enable a kind", async () => {
    const onChange = vi.fn();
    render(<PageKinds pages={[3]} value={{ 3: [] }} onChange={onChange} />);
    expect(screen.getByText(/skipped/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Character" }));
    expect(onChange).toHaveBeenCalledWith({ 3: ["character"] });
  });

  it("does not show skipped text for a page with kinds", () => {
    render(<PageKinds pages={[1]} value={{ 1: ["grammar"] }} onChange={() => {}} />);
    expect(screen.queryByText(/skipped/)).not.toBeInTheDocument();
  });
});
