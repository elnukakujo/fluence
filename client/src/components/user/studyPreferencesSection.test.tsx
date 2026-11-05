// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ updateUserPreferences: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/userPreferences", () => api);

import StudyPreferencesSection from "./studyPreferencesSection";

const lastSaved = () => api.updateUserPreferences.mock.calls.at(-1)![1];
// the save button is disabled briefly after a save, so submit the form itself
const save = async () => { fireEvent.submit(document.querySelector("form")!); await Promise.resolve(); };
beforeEach(() => vi.clearAllMocks());

describe("study preferences", () => {
    it("saves the 2 front then 1 back preset", async () => {
        render(<StudyPreferencesSection preferences={{ id: "pref_1" }} />);
        await userEvent.click(screen.getByRole("button", { name: "2 front, then 1 back" }));
        await save();
        expect(lastSaved().voc_side_pattern).toEqual({ mode: "cycle", cycle: ["F", "F", "B"] });
    });

    it("saves a custom 3:1 ratio and blocks 0:0", async () => {
        render(<StudyPreferencesSection preferences={{ id: "pref_1" }} />);
        await userEvent.click(screen.getByRole("button", { name: "Custom" }));
        const [front, back] = screen.getAllByRole("spinbutton");
        await userEvent.clear(front); await userEvent.type(front, "3");
        await save();
        expect(lastSaved().voc_side_pattern).toEqual({ mode: "random", front: 3, back: 1 });
        await userEvent.clear(front); await userEvent.type(front, "0");
        await userEvent.clear(back); await userEvent.type(back, "0");
        api.updateUserPreferences.mockClear();
        await save();
        expect(api.updateUserPreferences).not.toHaveBeenCalled();
        expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("toggles ban on an exercise type and back off", async () => {
        render(<StudyPreferencesSection preferences={{ id: "pref_1" }} />);
        const essayBan = screen.getAllByRole("button", { name: "Ban" })[0];
        await userEvent.click(essayBan);
        expect(essayBan).toHaveAttribute("aria-pressed", "true");
        await save();
        expect(Object.values(lastSaved().exercise_type_prefs)).toEqual(["ban"]);
        await userEvent.click(essayBan);
        await save();
        expect(lastSaved().exercise_type_prefs).toEqual({});
    });

    it("reorders review sections", async () => {
        render(<StudyPreferencesSection preferences={{ id: "pref_1" }} />);
        await userEvent.click(screen.getByRole("button", { name: "Customize the order" }));
        await userEvent.click(screen.getAllByRole("button", { name: "Move up" })[1]);   // grammar above vocabulary
        await save();
        expect(lastSaved().review_layout.map((s: { type: string }) => s.type)).toEqual(["gram", "voc", "ex", "call"]);
    });
});
