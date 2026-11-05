// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ setExerciseUserPref: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/exercise", () => api);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import ExerciseUserPrefMenu from "./exerciseUserPrefMenu";

beforeEach(() => vi.clearAllMocks());

describe("exercise user pref menu", () => {
    it("bans, then resets by pressing the active mode again", async () => {
        render(<ExerciseUserPrefMenu exerciseId="ex_1" mode={null} />);
        const ban = screen.getByRole("button", { name: "Ban" });
        await userEvent.click(ban);
        expect(api.setExerciseUserPref).toHaveBeenLastCalledWith("ex_1", "ban");
        expect(ban).toHaveAttribute("aria-pressed", "true");
        await userEvent.click(ban);
        expect(api.setExerciseUserPref).toHaveBeenLastCalledWith("ex_1", null);
    });
    it("shows the stored mode", () => {
        render(<ExerciseUserPrefMenu exerciseId="ex_1" mode="boost" />);
        expect(screen.getByRole("button", { name: "Boost" })).toHaveAttribute("aria-pressed", "true");
    });
});
