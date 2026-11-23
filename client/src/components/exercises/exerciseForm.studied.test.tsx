// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/exercise", () => ({ createExercise: vi.fn(), updateExercise: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/tags/tagSelector", () => ({ default: () => null }));
vi.mock("@/components/sources/sourceSelector", () => ({ default: () => null }));
vi.mock("@/components/media/mediaLoader", () => ({ default: () => null }));
vi.mock("@/components/ui/selectMenu/openCloseMenu", () => ({ default: ({ label }: { label: string }) => <p data-testid="menu">{label}</p> }));
vi.mock("@/api/settings", () => ({ getSettingsGroup: vi.fn() }));

import ExerciseForm from "./exerciseForm";
import { getStudiedTypes, studiedElements } from "@/lib/studiedTypes";
import { getSettingsGroup } from "@/api/settings";

const all = { vocabularies: [], grammars: [], calligraphies: [] };

describe("a type the course does not study (SG-14)", () => {
    it("is not offered as an association in the exercise form", () => {
        render(<ExerciseForm exercise={{ id: "ex_1", exercise_type: "essay", question: "q", answer: "a", lesson_id: "l" }} lesson_id="l"
            lessonElements={studiedElements(["vocabulary", "grammar", "exercises"], all) as never} />);
        const menus = screen.getAllByTestId("menu").map((m) => m.textContent);
        expect(menus.some((m) => /alligraph/.test(m ?? ""))).toBe(false);
        expect(menus.length).toBe(2);
    });
    it("studiedElements keeps the studied lists and drops the rest", () => {
        expect(Object.keys(studiedElements(["vocabulary"], all)).filter((k) => (studiedElements(["vocabulary"], all) as Record<string, unknown>)[k] !== undefined)).toEqual(["vocabularies"]);
    });
    it("every type is studied when nothing is set or the setting cannot be read", async () => {
        vi.mocked(getSettingsGroup).mockResolvedValueOnce({ values: {}, scopes: {}, overridden: [] });
        expect(await getStudiedTypes("l")).toEqual(["vocabulary", "grammar", "calligraphy", "exercises"]);
        vi.mocked(getSettingsGroup).mockRejectedValueOnce(new Error("x"));
        expect(await getStudiedTypes("l")).toHaveLength(4);
        vi.mocked(getSettingsGroup).mockResolvedValueOnce({ values: { element_types: ["vocabulary"] }, scopes: {}, overridden: [] });
        expect(await getStudiedTypes("l")).toEqual(["vocabulary"]);
    });
});
