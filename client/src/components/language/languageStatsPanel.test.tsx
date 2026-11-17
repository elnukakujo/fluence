// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type DailyStats from "@/interface/dataCollection/DailyStats";
import type CommitmentLog from "@/interface/dataCollection/CommitmentLog";
import LanguageStatsPanel from "./LanguageStatsPanel";

const daily = { items_reviewed: 12, items_correct: 9, time_studied_ms: 5 * 60000, streak_day: true, current_streak_length: 4 } as unknown as DailyStats;
const log = { days_active: 30, total_items_reviewed: 480, total_time_ms: 125 * 60000, longest_streak_ever: 11, created_at: "2026-01-01T00:00:00" } as unknown as CommitmentLog;

describe("language stats panel", () => {
    it("shows today and the commitment together, without tabs", () => {
        render(<LanguageStatsPanel dailyStats={daily} commitmentLog={log} />);
        expect(screen.queryByRole("tab")).toBeNull();
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Commitment" })).toBeInTheDocument();
        expect(screen.getByText("75%")).toBeInTheDocument();      // 9 of 12
        expect(screen.getByText("5 min")).toBeInTheDocument();
        expect(screen.getByText("2h 5m")).toBeInTheDocument();
        expect(screen.getByText("Streak day")).toBeInTheDocument();
    });

    it("a language with no answers yet shows zeros, not NaN, and a commitment placeholder", () => {
        const none = { ...daily, items_reviewed: 0, items_correct: 0, time_studied_ms: 0, streak_day: false, current_streak_length: 0 } as unknown as DailyStats;
        const { container } = render(<LanguageStatsPanel dailyStats={none} commitmentLog={null} />);
        expect(container.textContent).not.toMatch(/NaN|undefined/);
        expect(screen.getByText("0%")).toBeInTheDocument();
        expect(screen.getByText("No commitment data")).toBeInTheDocument();
        expect(screen.getByText("Building streak")).toBeInTheDocument();
    });

    it("someone else's language has no daily card", () => {
        render(<LanguageStatsPanel dailyStats={null} commitmentLog={log} />);
        expect(screen.queryByRole("heading", { name: "Today" })).toBeNull();
        expect(screen.getByRole("heading", { name: "Commitment" })).toBeInTheDocument();
    });
});
