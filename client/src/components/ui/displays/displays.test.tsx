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

describe("the gauges give the exact value", () => {
  it("score and difficulty expose it as the accessible name and in the tooltip", () => {
    render(<><ScoreDisplay score={42.46} /><DifficultyDisplay difficulty={0.4} /></>);
    expect(screen.getByRole("img", { name: "Score: 42.5 / 100" })).toHaveTextContent("42.5 / 100");
    expect(screen.getByRole("img", { name: "Difficulty: 0.4 / 1" })).toHaveTextContent("0.4 / 1");
  });
});
