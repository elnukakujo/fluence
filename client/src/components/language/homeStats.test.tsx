// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type HomeStats from "@/interface/dataCollection/HomeStats";
import HomeHeadline from "./homeHeadline";
import LanguageSummaryCard from "./languageSummaryCard";
import LevelMiniBar from "./levelMiniBar";
import PracticeHeatmap, { DEFAULT_BANDS } from "./practiceHeatmap";

const summary = { id: "lang_1", name: "Japanese", levels: { learning: 3, known: 2, mastered: 1 }, fading: 2, coverage: 0.5, mean_seen: 71.4, due: 12, due_minutes: 9, minutes_today: 4 };
const stats = (over: Partial<HomeStats> = {}): HomeStats => ({
  streak: 5, today: { answers: 7, min: 20, validated: false }, languages: [summary], weeks: [], heatmap_bands: [4, 14, 29], week_delta: 0, ...over });

describe("home stats", () => {
  it("the level bar writes the counts out, not only colours", () => {
    render(<LevelMiniBar learning={3} known={2} mastered={1} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Learning 3, Known 2, Mastered 1");
  });

  it("an empty learner renders without NaN or a broken bar", () => {
    const empty = { ...summary, levels: { learning: 0, known: 0, mastered: 0 }, fading: 0, coverage: 0, mean_seen: null, due: 0, due_minutes: 0, minutes_today: 0 };
    const { container } = render(<LanguageSummaryCard language={empty} />);
    expect(container.textContent).not.toMatch(/NaN|undefined/);
    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("the card shows levels, due and minutes, and coverage apart from the average of seen", () => {
    render(<LanguageSummaryCard language={summary} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/languages/lang_1");
    expect(screen.getByText("12 cards · about 9 min")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("71")).toBeInTheDocument();
  });

  it("the headline sums fading items over all languages", () => {
    render(<HomeHeadline stats={stats({ languages: [summary, { ...summary, id: "lang_2", fading: 3 }] })} />);
    expect(screen.getByText("5 days")).toBeInTheDocument();
    expect(screen.getByText("7 / 20 answers")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("the heatmap legend shows the band edges it was given", () => {
    const { rerender } = render(<PracticeHeatmap history={[]} bands={DEFAULT_BANDS} />);
    expect(screen.getByText("30+")).toBeInTheDocument();
    rerender(<PracticeHeatmap history={[]} bands={[10, 30, 60]} weekDelta={-3} />);
    expect(screen.getByText("61+")).toBeInTheDocument();
    expect(screen.getByText(/-3 vs last week/)).toBeInTheDocument();
  });
});
