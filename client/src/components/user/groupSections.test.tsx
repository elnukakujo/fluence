// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerSection, PaceSection } from "./groupSections";

const api = vi.hoisted(() => ({ getSettingsGroup: vi.fn(), saveSettingsGroup: vi.fn(), applyPreset: vi.fn() }));
vi.mock("@/api/settings", () => api);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const wrap = (ui: React.ReactNode) => render(<>{ui}</>);
const group = (values: Record<string, unknown>, scopes: Record<string, string> = {}) => ({ values, scopes, overridden: [] });

describe("settings groups", () => {
    beforeEach(() => Object.values(api).forEach((m) => m.mockReset()));
    afterEach(cleanup);

    it("saves only the changed keys of its own group", async () => {
        api.getSettingsGroup.mockResolvedValue(group({ hints_enabled: true, retry_wrong: true, calligraphy_draw_first: true, calligraphy_stroke_guide: true, audio_autoplay: false, typing_strictness: "forgiving" },
            { typing_strictness: "course" }));
        api.saveSettingsGroup.mockResolvedValue(group({ hints_enabled: false }));
        wrap(<AnswerSection languages={[{ id: "lang_1", name: "French" }]} />);
        await userEvent.click(await screen.findByRole("switch", { name: /Hints/ }));
        await userEvent.click(screen.getByRole("button", { name: /save/i }));
        await waitFor(() => expect(api.saveSettingsGroup).toHaveBeenCalledWith("answer", { hints_enabled: false }, "lang_1"));
    });

    it("shows the three presets with their exact numbers and applies one", async () => {
        api.getSettingsGroup.mockResolvedValue(group({ streak_min_answers: 20, new_per_week: 15, reviews_per_day: 40, weekly_goals_on: true, soft_gate: true },
            { weekly_goals_on: "course", soft_gate: "course" }));
        api.applyPreset.mockResolvedValue(group({}));
        wrap(<PaceSection languages={[{ id: "lang_1", name: "French" }]} />);
        for (const [n, r, s] of [[5, 20, 10], [15, 40, 20], [30, 80, 40]]) {
            expect(await screen.findByText(`${n} new items per week`)).toBeInTheDocument();
            expect(screen.getByText(`${r} reviews per day`)).toBeInTheDocument();
            expect(screen.getByText(`Streak day: ${s} answers`)).toBeInTheDocument();
        }
        await userEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]);
        await waitFor(() => expect(api.applyPreset).toHaveBeenCalledWith("casual"));
    });
});
