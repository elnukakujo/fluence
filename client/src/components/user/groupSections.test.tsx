// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerBlock, PaceBlock } from "./groupSections";
import CourseSettings from "./courseSettings";

const api = vi.hoisted(() => ({ getSettingsGroup: vi.fn(), saveSettingsGroup: vi.fn(), applyPreset: vi.fn() }));
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

    it("pace holds the daily minutes, the streak minimum and the three presets with their exact numbers, and applies one", async () => {
        api.getSettingsGroup.mockResolvedValue(group({ daily_goal_minutes: 20, streak_min_answers: 20 }));
        api.applyPreset.mockResolvedValue(group({}));
        render(<PaceBlock />);
        expect(await screen.findByText("Daily study minutes")).toBeInTheDocument();
        for (const [n, r, s] of [[5, 20, 10], [15, 40, 20], [30, 80, 40]]) {
            expect(screen.getByText(`${n} new items per week`)).toBeInTheDocument();
            expect(screen.getByText(`${r} reviews per day`)).toBeInTheDocument();
            expect(screen.getByText(`Streak day: ${s} answers`)).toBeInTheDocument();
        }
        await userEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]);
        await waitFor(() => expect(api.applyPreset).toHaveBeenCalledWith("casual"));
    });

    it("per-course settings share one course menu and one Save, each group saved for that course", async () => {
        api.getSettingsGroup.mockImplementation(async (g: string) => group(
            { pace: { weekly_goals_on: true, soft_gate: true }, review: { element_types: ["vocabulary"], include_shared: true }, answer: { typing_strictness: "forgiving" }, see: { show_phonetics: "after_reveal" } }[g] ?? {}));
        api.saveSettingsGroup.mockResolvedValue(group({}));
        render(<CourseSettings languages={[{ id: "lang_1", name: "French" }, { id: "lang_2", name: "Chinese" }]} fold={false} />);
        await userEvent.click(await screen.findByRole("switch", { name: /Weekly study goals/ }));
        await userEvent.click(screen.getByRole("switch", { name: /Include shared lessons/ }));
        expect(screen.getAllByText("Course")).toHaveLength(1);
        await userEvent.click(screen.getByRole("button", { name: /save/i }));
        await waitFor(() => expect(api.saveSettingsGroup).toHaveBeenCalledTimes(2));
        expect(api.saveSettingsGroup).toHaveBeenCalledWith("pace", { weekly_goals_on: false }, "lang_1");
        expect(api.saveSettingsGroup).toHaveBeenCalledWith("review", { include_shared: false }, "lang_1");
    });
});
