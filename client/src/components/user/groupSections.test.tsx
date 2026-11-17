// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerBlock, AppearanceBlock, PaceBlock } from "./groupSections";
import { pick } from "@/test/selectMenu";
import CourseSettings from "./courseSettings";

const api = vi.hoisted(() => ({ getSettingsGroup: vi.fn(), saveSettingsGroup: vi.fn() }));
vi.mock("@/api/settings", () => api);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const group = (values: Record<string, unknown>, overridden: string[] = []) => ({ values, scopes: {}, overridden });

describe("settings blocks", () => {
    beforeEach(() => Object.values(api).forEach((m) => m.mockReset()));
    afterEach(cleanup);

    it("saves only the changed keys of its own group", async () => {
        api.getSettingsGroup.mockResolvedValue(group({ hints_enabled: true, retry_wrong: true, calligraphy_draw_first: true, calligraphy_stroke_guide: true, audio_autoplay: false }));
        api.saveSettingsGroup.mockResolvedValue(group({ hints_enabled: false }));
        render(<AnswerBlock />);
        await userEvent.click(await screen.findByRole("switch", { name: /Hints/ }));
        await userEvent.click(screen.getByRole("button", { name: /save/i }));
        await waitFor(() => expect(api.saveSettingsGroup).toHaveBeenCalledWith("answer", { hints_enabled: false }));
    });

    it("pace holds new per week, reviews per day, the streak minimum and the three presets with their exact numbers, and a preset only fills the form until Save", async () => {
        api.getSettingsGroup.mockResolvedValue(group({ new_per_week: 15, reviews_per_day: 40, streak_min_answers: 20 }));
        render(<PaceBlock />);
        expect(await screen.findByText("Reviews per day")).toBeInTheDocument();
        for (const [n, r, s] of [[5, 20, 10], [15, 40, 20], [30, 80, 40]]) {
            expect(screen.getByText(`${n} new items per week`)).toBeInTheDocument();
            expect(screen.getByText(`${r} reviews per day`)).toBeInTheDocument();
            expect(screen.getByText(`Streak day: ${s} answers`)).toBeInTheDocument();
        }
        await userEvent.click(screen.getByRole("button", { name: "Apply the Casual preset" }));
        expect(api.saveSettingsGroup).not.toHaveBeenCalled();                      // a tap saves nothing
        expect(screen.getByRole("spinbutton", { name: /Reviews per day/ })).toHaveValue(20);
        await userEvent.click(screen.getByRole("button", { name: /save/i }));
        await waitFor(() => expect(api.saveSettingsGroup).toHaveBeenCalledWith("pace", { new_per_week: 5, reviews_per_day: 20, streak_min_answers: 10 }));
    });

    it("per-course settings share one course menu and one Save, each group saved for that course", async () => {
        api.getSettingsGroup.mockImplementation(async (g: string) => group(
            { pace: { soft_gate: true }, review: { element_types: ["vocabulary"], include_shared: true }, answer: { typing_strictness: "forgiving" }, see: { show_phonetics: "after_reveal" } }[g] ?? {}));
        api.saveSettingsGroup.mockResolvedValue(group({}));
        render(<CourseSettings languages={[{ id: "lang_1", name: "French" }, { id: "lang_2", name: "Chinese" }]} fold={false} />);
        await userEvent.click(await screen.findByRole("switch", { name: /Suggest earlier lessons first/ }));
        await userEvent.click(screen.getByRole("switch", { name: /Include shared lessons/ }));
        expect(screen.getAllByText("Course")).toHaveLength(1);
        await userEvent.click(screen.getByRole("button", { name: /save/i }));
        await waitFor(() => expect(api.saveSettingsGroup).toHaveBeenCalledTimes(2));
        expect(api.saveSettingsGroup).toHaveBeenCalledWith("pace", { soft_gate: false }, "lang_1");
        expect(api.saveSettingsGroup).toHaveBeenCalledWith("review", { include_shared: false }, "lang_1");
    });

    it("element types offer calligraphy but no separate characters or radicals", async () => {
        api.getSettingsGroup.mockImplementation(async () => group({ soft_gate: true, element_types: ["vocabulary"], include_shared: true, typing_strictness: "forgiving", show_phonetics: "after_reveal" }));
        render(<CourseSettings languages={[{ id: "lang_1", name: "French" }]} />);
        await userEvent.click(await screen.findByRole("combobox", { name: "Element types" }));
        const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
        expect(options).toEqual(expect.arrayContaining(["Calligraphy"]));
        expect(options).not.toContain("Characters");
        expect(options).not.toContain("Radicals");
    });

    it("appearance saves as you pick, with no Save button", async () => {
        api.getSettingsGroup.mockResolvedValue(group({ theme: "system", show_scores: false }));
        api.saveSettingsGroup.mockResolvedValue(group({ theme: "dark", show_scores: false }));
        render(<AppearanceBlock />);
        await pick(await screen.findByRole("combobox", { name: "Theme" }), "Dark");
        await waitFor(() => expect(api.saveSettingsGroup).toHaveBeenCalledWith("see", { theme: "dark" }));
        expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
    });
});
