// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
    useTranslations: () => (k: string, v?: Record<string, string>) => (v ? `${k}:${Object.values(v).join(",")}` : k),
}));

import CharacterLinksField from "./characterLinksField";

function Harness({ known = ["氵", "方"], creating = false, initialComponents = [] as string[], initialRadical = "" }) {
    const [radical, setRadical] = useState(initialRadical);
    const [components, setComponents] = useState<string[]>(initialComponents);
    return <CharacterLinksField own="河" known={known} creating={creating} radical={radical} onRadical={setRadical} components={components} onComponents={setComponents} />;
}

describe("CharacterLinksField", () => {
    it("says whether the typed radical exists or will be created", async () => {
        render(<Harness />);
        await userEvent.type(screen.getByLabelText("radicalLabel"), "氵");
        expect(screen.getByText("radicalExists:氵")).toBeInTheDocument();
        await userEvent.clear(screen.getByLabelText("radicalLabel"));
        await userEvent.type(screen.getByLabelText("radicalLabel"), "火");
        expect(screen.getByText("radicalNew:火")).toBeInTheDocument();
    });

    it("adds components as chips on Enter, space or comma, marks the new ones, ignores duplicates and the character itself", async () => {
        render(<Harness />);
        const input = screen.getByLabelText("componentsLabel");
        await userEvent.type(input, "氵可 河{Enter}");
        expect(screen.getByText("氵")).toBeInTheDocument();
        expect(screen.getByText("可")).toBeInTheDocument();
        expect(screen.queryByText("河")).toBeNull();
        expect(screen.getAllByText("componentNew")).toHaveLength(1);       // 可 does not exist yet, 氵 does
        await userEvent.type(input, "氵,");
        expect(screen.getAllByText("氵")).toHaveLength(1);
    });

    it("removes a chip with its button and with Backspace in the empty field", async () => {
        render(<Harness initialComponents={["氵", "可"]} />);
        await userEvent.click(screen.getByRole("button", { name: "removeComponent:氵" }));
        expect(screen.queryByText("氵")).toBeNull();
        await userEvent.click(screen.getByLabelText("componentsLabel"));
        await userEvent.keyboard("{Backspace}");
        expect(screen.queryByText("可")).toBeNull();
    });

    it("explains the autofill only when creating", () => {
        const { rerender } = render(<Harness creating />);
        expect(screen.getByText("structureHintCreate")).toBeInTheDocument();
        rerender(<Harness />);
        expect(screen.getByText("structureHintUpdate")).toBeInTheDocument();
    });
});
