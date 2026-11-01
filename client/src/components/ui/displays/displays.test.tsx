// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ScoreDisplay from "./scoreDisplay";
import DifficultyDisplay from "./difficultyDisplay";

// These are rendered inside client components, so they must be synchronous (no getTranslations).
describe("shared displays render synchronously with translated labels", () => {
  it("ScoreDisplay", () => {
    render(<ScoreDisplay score={50} />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
  it("DifficultyDisplay keeps Medium and Trivial", () => {
    const { rerender } = render(<DifficultyDisplay difficulty={0.4} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    rerender(<DifficultyDisplay difficulty={0.9} />);
    expect(screen.getByText("Trivial")).toBeInTheDocument();
  });
});
