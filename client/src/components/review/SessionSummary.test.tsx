// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SessionSummary, { formatSessionTime } from "./SessionSummary";

vi.mock("@/api/review/sessionStats", () => ({ getSessionStats: vi.fn().mockResolvedValue({ cards: 70, correct: 52, duration_ms: 312000, avg_score_gain: 4.26, avg_difficulty_change: -0.031, by_type: {} }) }));

describe("SessionSummary", () => {
    it("shows cards, correct, time, average gain and difficulty change", async () => {
        render(<SessionSummary sessionId="s1" />);
        expect(await screen.findByText("52/70")).toBeTruthy();
        expect(screen.getByText("70")).toBeTruthy();
        expect(screen.getByText("5m 12s")).toBeTruthy();
        expect(screen.getByText("+4.3")).toBeTruthy();
        expect(screen.getByText("-0.031")).toBeTruthy();
    });
    it("formats short and long times", () => {
        expect(formatSessionTime(42000)).toBe("42s");
        expect(formatSessionTime(125000)).toBe("2m 5s");
    });
});
