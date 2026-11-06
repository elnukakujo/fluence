// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getStudyGoal: vi.fn(), saveStudyGoal: vi.fn(), resetStudyGoal: vi.fn() }));
vi.mock("@/api/studyGoal", () => api);
vi.mock("@/api/language", () => ({ getAvailableLanguages: vi.fn().mockResolvedValue([{ id: "lang_1", name: "Japanese" }]) }));

import StudyGoalsCard from "./studyGoalCard";

const empty = { goal: null, progress: null };
const types = (n: number, r: number) => ({ n, picked: n, mastered: 0, carried: 0, r, review_picked: r, review_done: 0 });
const locked = {
    goal: { id: "g", language_id: "lang_1", period: "week", start_date: "2026-11-05", n_vocabulary: 25, n_grammar: 0, n_calligraphy: 0, r_vocabulary: 10, r_grammar: 0, r_calligraphy: 0, active: true, auto: false },
    progress: { period: "week", active: true, cycle_start: "2026-11-05", cycle_end: "2026-11-12", items: [],
        types: { vocabulary: types(20, 5), grammar: types(0, 0), calligraphy: types(0, 0) },
        next: { start: "2026-11-12", period: "week", pending: true, n: { vocabulary: 25, grammar: 0, calligraphy: 0 }, r: { vocabulary: 10, grammar: 0, calligraphy: 0 } } },
};
beforeEach(() => { vi.clearAllMocks(); api.getStudyGoal.mockResolvedValue(empty); api.saveStudyGoal.mockResolvedValue(empty); });

describe("study goals card", () => {
    it("sends the period and the new and review quantities of each type, only for edited languages", async () => {
        render(<StudyGoalsCard userId="u" />);
        await userEvent.click(await screen.findByRole("button", { name: "Every 2 weeks" }));
        await userEvent.click(screen.getAllByRole("button", { name: "Increase" })[0]);   // vocabulary: new
        await userEvent.click(screen.getAllByRole("button", { name: "Increase" })[1]);   // vocabulary: review
        fireEvent.submit(document.querySelector("form")!);
        await screen.findByRole("button", { name: /save/i });
        expect(api.saveStudyGoal).toHaveBeenCalledWith("lang_1", { period: "biweek", active: true, n_vocabulary: 1, n_grammar: 0, n_calligraphy: 0, r_vocabulary: 1, r_grammar: 0, r_calligraphy: 0, auto: false });
        api.saveStudyGoal.mockClear();
        fireEvent.submit(document.querySelector("form")!);
        await Promise.resolve();
        expect(api.saveStudyGoal).not.toHaveBeenCalled();
    });

    it("shows a suggested goal as following the daily time; editing a number makes it the user's own, and 'use suggested' goes back", async () => {
        const auto = { ...locked, goal: { ...locked.goal, auto: true }, suggested: { n: { vocabulary: 25, grammar: 6, calligraphy: 12 }, r: { vocabulary: 13, grammar: 3, calligraphy: 6 } } };
        api.getStudyGoal.mockResolvedValue(auto);
        render(<StudyGoalsCard userId="u" />);
        expect(await screen.findByText("Suggested for your daily time")).toBeInTheDocument();
        await userEvent.click(screen.getAllByRole("button", { name: "Increase" })[0]);
        expect(screen.getByText("Your own values")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Use suggested values" }));
        expect(screen.getByText("Suggested for your daily time")).toBeInTheDocument();
        fireEvent.submit(document.querySelector("form")!);
        await screen.findByRole("button", { name: /save/i });
        expect(api.saveStudyGoal).toHaveBeenCalledWith("lang_1", expect.objectContaining({ auto: true, n_vocabulary: 25, r_calligraphy: 6 }));
    });

    it("tells the menu is locked and when the saved changes start", async () => {
        api.getStudyGoal.mockResolvedValue(locked);
        render(<StudyGoalsCard userId="u" />);
        expect(await screen.findByRole("note")).toHaveTextContent(/locked/i);
        expect(screen.getByRole("note")).toHaveTextContent(/Vocabulary\s*20\s*new\s*5\s*review/);
        expect(screen.getByRole("note")).toHaveTextContent(/Your changes start on Nov 12/);
    });

    it("the lock opens the rebuild dialog; confirming rebuilds, keeping the mastered ones", async () => {
        api.getStudyGoal.mockResolvedValue({ ...locked, progress: { ...locked.progress, rebuild: { mastered: 2, redraw: 9 } } });
        api.resetStudyGoal.mockResolvedValue(locked);
        render(<StudyGoalsCard userId="u" />);
        await userEvent.click(await screen.findByRole("button", { name: /unlock to rebuild/i }));
        expect(screen.getByRole("dialog")).toHaveTextContent("2");
        await userEvent.click(screen.getByRole("button", { name: "Rebuild" }));
        expect(api.resetStudyGoal).toHaveBeenCalledWith("lang_1");
    });
});
