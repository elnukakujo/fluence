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
    expect(screen.getByText("Learning")).toBeInTheDocument();
  });
  it("ScoreDisplay names the three levels and flags weak", () => {
    const { rerender } = render(<ScoreDisplay score={45} />);
    expect(screen.getByText("Learning")).toBeInTheDocument();
    rerender(<ScoreDisplay score={30} />);
    expect(screen.getByText("Weak")).toBeInTheDocument();
    rerender(<ScoreDisplay score={0} />);
    expect(screen.getByText("Unseen")).toBeInTheDocument();
    rerender(<ScoreDisplay score={7.5} stability={4} />);
    expect(screen.getByText("Weak")).toBeInTheDocument();
    expect(screen.getByText("Fading in ~4 days")).toBeInTheDocument();
    rerender(<ScoreDisplay score={70} />);
    expect(screen.getByText("Known")).toBeInTheDocument();
    rerender(<ScoreDisplay score={90} />);
    expect(screen.getByText("Mastered")).toBeInTheDocument();
  });
  it("ScoreDisplay shows the fading estimate, capped at 99+", () => {
    const { rerender } = render(<ScoreDisplay score={70} stability={10} />);
    expect(screen.getByText("Fading in ~2 days")).toBeInTheDocument();
    rerender(<ScoreDisplay score={99} stability={500} />);
    expect(screen.getByText("Fading in ~99+ days")).toBeInTheDocument();
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
