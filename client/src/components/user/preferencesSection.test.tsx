// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ updateUserPreferences: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/userPreferences", () => api);
vi.mock("@/api/language", () => ({ getAvailableLanguages: vi.fn().mockResolvedValue([]) }));
vi.mock("@/api/studyGoal", () => ({ getStudyGoal: vi.fn(), saveStudyGoal: vi.fn() }));

import PreferencesSection from "./preferencesSection";

const lastSaved = () => api.updateUserPreferences.mock.calls.at(-1)![1];
// the save button is disabled briefly after a save, so submit the form itself
const save = async () => { fireEvent.submit(document.querySelector("form")!); await Promise.resolve(); };
beforeEach(() => vi.clearAllMocks());

describe("learning preferences", () => {
    it("saves ratio and order as two separate settings", async () => {
        render(<PreferencesSection preferences={{ id: "pref_1" }} />);
        const front = screen.getByRole("spinbutton", { name: "Front" });
        await userEvent.clear(front); await userEvent.type(front, "2");
        await save();
        expect(lastSaved().voc_side_pattern).toEqual({ mode: "random", front: 2, back: 1 });
        await userEvent.click(screen.getByRole("button", { name: "In turns" }));
        await save();
        expect(lastSaved().voc_side_pattern).toEqual({ mode: "cycle", cycle: ["F", "F", "B"] });
        await userEvent.click(screen.getByRole("button", { name: "Front, then back" }));
        await save();
        expect(lastSaved().voc_side_pattern).toEqual({ mode: "split" });
    });

    it("blocks a 0:0 ratio", async () => {
        render(<PreferencesSection preferences={{ id: "pref_1" }} />);
        const front = screen.getByRole("spinbutton", { name: "Front" });
        const back = screen.getByRole("spinbutton", { name: "Back" });
        await userEvent.clear(front); await userEvent.type(front, "0");
        await userEvent.clear(back); await userEvent.type(back, "0");
        await save();
        expect(api.updateUserPreferences).not.toHaveBeenCalled();
        expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("adds an exercise type to the boosted and banned lists and removes it", async () => {
        render(<PreferencesSection preferences={{ id: "pref_1" }} />);
        await userEvent.selectOptions(screen.getByRole("combobox", { name: "Add an exercise type to boost" }), "essay");
        await userEvent.selectOptions(screen.getByRole("combobox", { name: "Add an exercise type to ban" }), "matching");
        await save();
        expect(lastSaved().exercise_type_prefs).toEqual({ essay: "boost", matching: "ban" });
        await userEvent.click(screen.getByRole("button", { name: "Remove Essay" }));
        await save();
        expect(lastSaved().exercise_type_prefs).toEqual({ matching: "ban" });
    });

    it("plans the daily review: add sections, reorder with the arrow keys, remove", async () => {
        render(<PreferencesSection preferences={{ id: "pref_1" }} />);
        for (const name of ["Vocabulary", "Grammar", "Exercises"]) await userEvent.click(screen.getByRole("button", { name }));
        screen.getByRole("button", { name: /Move Grammar/ }).focus();
        await userEvent.keyboard("{ArrowUp}");
        await save();
        expect(lastSaved().review_layout.map((s: { type: string }) => s.type)).toEqual(["gram", "voc", "ex"]);
        await userEvent.click(screen.getByRole("button", { name: "Remove Vocabulary" }));
        await save();
        expect(lastSaved().review_layout.map((s: { type: string }) => s.type)).toEqual(["gram", "ex"]);
    });
});
