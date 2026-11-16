// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
    useTranslations: () => (k: string, v?: Record<string, string>) => (v ? `${k}:${Object.values(v).join(",")}` : k),
}));

import CharacterLinksField, { type RadicalOption } from "./characterLinksField";

const RADICALS: RadicalOption[] = [
    { character: "氵", meaning: "water", id: "c1" },
    { character: "火", meaning: "fire", id: null },
    { character: "木", meaning: "tree", id: null },
];

function Harness({ creating = false, initialComponents = [] as string[], initialRadical = "" }) {
    const [radical, setRadical] = useState(initialRadical);
    const [components, setComponents] = useState<string[]>(initialComponents);
    return (
        <>
            <CharacterLinksField own="河" radicals={RADICALS} creating={creating} radical={radical} onRadical={setRadical} components={components} onComponents={setComponents} />
            <output data-testid="state">{JSON.stringify({ radical, components })}</output>
        </>
    );
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!);

describe("CharacterLinksField (select only)", () => {
    it("offers only radicals, with their meaning, and finds one by its meaning", async () => {
        render(<Harness />);
        await userEvent.click(screen.getByRole("combobox", { name: "radicalLabel" }));
        expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["氵water", "火fire", "木tree"]);
        await userEvent.keyboard("fire");
        expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["火fire"]);
        await userEvent.keyboard("{Enter}");
        expect(state().radical).toBe("火");
    });

    it("typing Latin letters never turns into characters (no stray t, e, s, t chips)", async () => {
        render(<Harness />);
        const box = screen.getByRole("combobox", { name: "componentsLabel" });
        await userEvent.click(box);
        await userEvent.keyboard("test");
        expect(screen.queryAllByRole("option")).toHaveLength(0);
        expect(state().components).toEqual([]);
        await userEvent.keyboard("{Enter}");
        expect(state().components).toEqual([]);
    });

    it("components are chosen one by one into chips, the new ones are marked, and each can be removed", async () => {
        render(<Harness />);
        await userEvent.click(screen.getByRole("combobox", { name: "componentsLabel" }));
        await userEvent.click(screen.getByRole("option", { name: /氵/ }));
        await userEvent.click(screen.getByRole("option", { name: /火/ }));
        expect(state().components).toEqual(["氵", "火"]);
        expect(screen.getByText("火 · componentNew")).toBeInTheDocument();     // 火 is not in the learner's language yet
        expect(screen.queryByText("氵 · componentNew")).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "removeOption:氵" }));
        expect(state().components).toEqual(["火"]);
    });

    it("never offers the character itself, keeps a current value that is not a radical, and says when the radical will be created", async () => {
        render(<Harness initialComponents={["可"]} initialRadical="火" />);
        expect(screen.getByText("可")).toBeInTheDocument();               // an autofilled component that is not in the radical list
        expect(screen.getByText("radicalNew:火")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("combobox", { name: "radicalLabel" }));
        expect(screen.queryByRole("option", { name: /河/ })).toBeNull();
    });

    it("explains the autofill only when creating", () => {
        const { rerender } = render(<Harness creating />);
        expect(screen.getByText("structureHintCreate")).toBeInTheDocument();
        rerender(<Harness />);
        expect(screen.getByText("structureHintUpdate")).toBeInTheDocument();
    });
});
