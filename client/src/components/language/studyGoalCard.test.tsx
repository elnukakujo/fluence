// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getStudyGoal: vi.fn(), saveStudyGoal: vi.fn(), pickStudyGoalNow: vi.fn() }));
vi.mock("@/api/studyGoal", () => api);

import StudyGoalCard from "./studyGoalCard";

const empty = { goal: null, progress: null };
beforeEach(() => { vi.clearAllMocks(); api.getStudyGoal.mockResolvedValue(empty); api.saveStudyGoal.mockResolvedValue(empty); });

describe("study goal card", () => {
    it("sends the period and the three quantities", async () => {
        render(<StudyGoalCard languageId="lang_1" />);
        await userEvent.click(await screen.findByRole("button", { name: "Every 2 weeks" }));
        const [voc, gram, call] = screen.getAllByRole("spinbutton");
        await userEvent.clear(voc); await userEvent.type(voc, "10");
        await userEvent.clear(gram); await userEvent.type(gram, "3");
        await userEvent.clear(call); await userEvent.type(call, "5");
        await userEvent.click(screen.getByRole("button", { name: "Save goal" }));
        expect(api.saveStudyGoal).toHaveBeenCalledWith("lang_1", { period: "biweek", active: true, n_vocabulary: 10, n_grammar: 3, n_calligraphy: 5 });
    });

    it("shows progress for the types with a quantity and the carried-over count", async () => {
        api.getStudyGoal.mockResolvedValue({
            goal: { id: "g", language_id: "lang_1", period: "week", start_date: "2026-01-01", n_vocabulary: 2, n_grammar: 0, n_calligraphy: 0, active: true },
            progress: { period: "week", active: true, cycle_start: "2026-01-01", cycle_end: "2026-01-08",
                types: { vocabulary: { n: 2, picked: 2, mastered: 1, carried: 3 }, grammar: { n: 0, picked: 0, mastered: 0, carried: 0 }, calligraphy: { n: 0, picked: 0, mastered: 0, carried: 0 } } },
        });
        render(<StudyGoalCard languageId="lang_1" />);
        expect(await screen.findByText(/1\/2 mastered/)).toBeInTheDocument();
        expect(screen.getByText(/\+3 carried over/)).toBeInTheDocument();
        expect(screen.queryByText(/New grammar —/)).toBeNull();
    });
});
