// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SessionSummary, { formatSessionTime } from "./SessionSummary";
import { getSessionStats } from "@/api/review/sessionStats";

vi.mock("@/api/review/sessionStats", () => ({ getSessionStats: vi.fn() }));
vi.mock("@/api/apiFetch", () => ({ reviewSessionIdle: () => Promise.resolve() }));

const base = { cards: 70, correct: 52, duration_ms: 312000, avg_score_gain: 4.26, avg_difficulty_change: -0.031, by_type: { vocabulary: 50, exercise: 20 },
    levels_crossed: [{ id: "voc_1", label: "你好", from: "learning", to: "known" }], to_revisit: ["voc_2", "ex_3"], hints_used: 7, avg_seconds_per_card: 4.5,
    goal_progress: { met: 6, total: 10, partial: 2.4 } };
const show = (over = {}) => { vi.mocked(getSessionStats).mockResolvedValue({ ...base, ...over }); return render(<SessionSummary sessionId="s1" languageId="lang_1" backHref="/languages/lang_1" againHref="/x" />); };

describe("SessionSummary", () => {
    beforeEach(() => vi.mocked(getSessionStats).mockReset());
    it("leads with cards, correct and time, then the green block, the red block and the figures", async () => {
        show();
        expect(await screen.findByText("52/70")).toBeInTheDocument();
        expect(screen.getByText("5m 12s")).toBeInTheDocument();
        expect(screen.getByTestId("levels-crossed")).toHaveTextContent("你好 · Known");
        expect(screen.getByTestId("to-revisit")).toHaveTextContent("2 cards to revisit");
        expect(screen.getByRole("link", { name: "Review these 2 now" })).toHaveAttribute("href", "/languages/lang_1/review/queue?scope=free&ids=voc_2%2Cex_3");
        expect(screen.getByText("+4.3")).toBeInTheDocument();
        expect(screen.getByText("7")).toBeInTheDocument();
        expect(screen.getByText("4.5s")).toBeInTheDocument();
        expect(screen.getByTestId("by-type")).toHaveTextContent("50 Vocabulary");
    });
    it("shows the week's goal as a bar with the partial layer", async () => {
        show();
        expect(await screen.findByText("6 / 10 met")).toBeInTheDocument();
        expect(screen.getByTestId("progress-partial")).toBeInTheDocument();
    });
    it("hides the green and red blocks, the missed button and the goal when there is nothing to show", async () => {
        show({ levels_crossed: [], to_revisit: [], goal_progress: null });
        await screen.findByText("52/70");
        expect(screen.queryByTestId("levels-crossed")).toBeNull();
        expect(screen.queryByTestId("to-revisit")).toBeNull();
        expect(screen.queryByRole("link", { name: /Review these/ })).toBeNull();
        expect(screen.queryByTestId("goal-progress")).toBeNull();
    });
    it("keeps back and another round in a bar and loads the totals once", async () => {
        show();
        await screen.findByText("52/70");
        expect(screen.getByRole("link", { name: "Another round" })).toHaveAttribute("href", "/x");
        expect(screen.getByRole("link", { name: /Back to course/ })).toHaveAttribute("href", "/languages/lang_1");
        expect(getSessionStats).toHaveBeenCalledTimes(1);
    });
    it("formats short and long times", () => {
        expect(formatSessionTime(42000)).toBe("42s");
        expect(formatSessionTime(125000)).toBe("2m 5s");
    });
});
