// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StudyGoalOverview from "./studyGoalOverview";

const row = (n: number, picked: number, mastered: number, carried = 0, r = 0, review_picked = 0, review_done = 0) => ({ n, picked, mastered, carried, r, review_picked, review_done });
const state = (active = true, pending = false) => ({
    goal: { id: "g", language_id: "l", period: "week" as const, start_date: "2026-11-05", n_vocabulary: 20, n_grammar: 0, n_calligraphy: 8, r_vocabulary: 10, r_grammar: 0, r_calligraphy: 0, active, auto: false },
    progress: { period: "week", active, cycle_start: "2026-11-05", cycle_end: "2026-11-12",
        types: { vocabulary: row(20, 20, 5, 3, 10, 10, 4), grammar: row(0, 0, 0), calligraphy: row(8, 8, 8) },
        items: [
            { id: "voc_1", kind: "vocabulary" as const, role: "new" as const, label: "水", lesson_id: "lesson_1", done: true, carried: false },
            { id: "voc_2", kind: "vocabulary" as const, role: "new" as const, label: "茶", lesson_id: "lesson_1", done: false, carried: true },
            { id: "voc_3", kind: "vocabulary" as const, role: "review" as const, label: "火", lesson_id: "lesson_2", done: false, carried: false },
        ],
        next: { start: "2026-11-12", period: "week", pending, n: { vocabulary: 25, grammar: 0, calligraphy: 8 }, r: { vocabulary: 10, grammar: 0, calligraphy: 0 } } },
});

describe("study goal menu", () => {
    it("shows new and review bars per type, the carried count and the days left", () => {
        render(<StudyGoalOverview state={state()} settingsHref="/s#goals" today={new Date("2026-11-07T10:00:00Z")} />);
        expect(screen.getByText("Vocabulary")).toBeInTheDocument();
        expect(screen.getByText("Calligraphy")).toBeInTheDocument();
        expect(screen.queryByText("Grammar")).toBeNull();
        expect(screen.getByLabelText("5/20 mastered")).toBeInTheDocument();
        expect(screen.getByLabelText("4 of 10 reviewed")).toBeInTheDocument();
        expect(screen.getByText(/\+3 carried over/)).toBeInTheDocument();
        expect(screen.getByText(/5 days left/)).toBeInTheDocument();
        expect(screen.queryByText(/new elements available|review elements available/)).toBeNull();
        expect(screen.getByRole("link", { name: /Edit goal/ })).toHaveAttribute("href", "/s#goals");
    });
    it("lists the menu in a New group and a Review group, done ones checked", () => {
        render(<StudyGoalOverview state={state()} settingsHref="/s" />);
        expect(screen.getByText("Show 3 elements")).toBeInTheDocument();
        for (const w of ["水", "茶", "火"]) expect(screen.getByText(new RegExp(w))).toBeInTheDocument();
    });
    it("links each element to its own page", () => {
        render(<StudyGoalOverview state={state()} settingsHref="/s" />);
        expect(screen.getByRole("link", { name: "水" })).toHaveAttribute("href", "/languages/l/lesson/lesson_1/voc/voc_1");
        expect(screen.getByRole("link", { name: /火/ })).toHaveAttribute("href", "/languages/l/lesson/lesson_2/voc/voc_3");
    });
    it("flags a type that has fewer picks than its quantity, and announces pending changes", () => {
        const s = state(true, true);
        s.progress.types.calligraphy = row(8, 3, 0);
        s.progress.types.vocabulary = row(20, 20, 5, 3, 10, 6, 4);
        render(<StudyGoalOverview state={s} settingsHref="/s" />);
        expect(screen.getByText("Only 3 of 8 new elements available")).toBeInTheDocument();
        expect(screen.getByText("Only 6 of 10 review elements available")).toBeInTheDocument();
        expect(screen.getByRole("note")).toHaveTextContent(/Next period \(from Nov 12\)/);
    });
    it("marks a paused goal and renders nothing without one", () => {
        const { rerender, container } = render(<StudyGoalOverview state={state(false)} settingsHref="/s" />);
        expect(screen.getByText("Paused")).toBeInTheDocument();
        rerender(<StudyGoalOverview state={{ goal: null, progress: null }} settingsHref="/s" />);
        expect(container).toBeEmptyDOMElement();
    });
});
