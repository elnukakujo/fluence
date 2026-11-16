// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string, v?: Record<string, string>) => (v ? `${k}:${Object.values(v).join(",")}` : k) }));

import ClassicSelectMenu from "./classicSelectMenu";

const LONG = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota"];
function Single({ options = LONG, onPick = vi.fn(), ...rest }: Partial<React.ComponentProps<typeof ClassicSelectMenu>> & { onPick?: (v: string) => void }) {
    const [v, setV] = useState<string>("");
    return <form onSubmit={(e) => { e.preventDefault(); onPick("SUBMITTED"); }}>
        <ClassicSelectMenu label="Letter" options={options} selectedOption={v} onChange={(x) => { setV(x as string); onPick(x as string); }} {...rest} /></form>;
}
function Multi(props: Partial<React.ComponentProps<typeof ClassicSelectMenu>>) {
    const [v, setV] = useState<string[]>([]);
    return <ClassicSelectMenu label="Letters" multiple options={LONG} selectedOption={v} onChange={(x) => setV(x as string[])} {...props} />;
}

describe("ClassicSelectMenu", () => {
    it("filters while typing, picks with the arrows and Enter, and does not submit the form", async () => {
        const onPick = vi.fn();
        render(<Single onPick={onPick} />);
        const box = screen.getByRole("combobox", { name: "Letter" });
        await userEvent.click(box);
        await userEvent.keyboard("et");                 // beta, zeta, eta, theta
        expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Beta", "Zeta", "Eta", "Theta"]);
        await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
        expect(onPick).toHaveBeenCalledTimes(1);
        expect(onPick).toHaveBeenCalledWith("eta");
        expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("finds an option by its hint or extra search words, and shows the hint", async () => {
        render(<Single options={["a", "b"]} searchable optionLabel={(v) => v.toUpperCase()} optionHint={(v) => (v === "a" ? "water" : undefined)} optionSearch={(v) => (v === "b" ? "fire" : undefined)} />);
        await userEvent.click(screen.getByRole("combobox"));
        expect(screen.getByText("water")).toBeInTheDocument();
        await userEvent.keyboard("fire");
        expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["B"]);
    });

    it("lists groups under headings and walks across them with the keyboard", async () => {
        const onPick = vi.fn();
        render(<Single options={["a", "b", "c"]} searchable groups={[{ label: "One", options: ["a"] }, { label: "Two", options: ["b", "c"] }]} onPick={onPick} />);
        await userEvent.click(screen.getByRole("combobox"));
        expect(screen.getByRole("group", { name: "Two" })).toBeInTheDocument();
        await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
        expect(onPick).toHaveBeenCalledWith("c");
    });

    it("Escape closes without choosing; Home and End jump", async () => {
        const onPick = vi.fn();
        render(<Single onPick={onPick} />);
        await userEvent.click(screen.getByRole("combobox"));
        await userEvent.keyboard("{End}{Enter}");
        expect(onPick).toHaveBeenCalledWith("iota");
        await userEvent.click(screen.getByRole("combobox"));
        await userEvent.keyboard("{Escape}");
        expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("a short list does not take typing (no phone keyboard) but still works with the arrows", async () => {
        const onPick = vi.fn();
        render(<Single options={["x", "y", "z"]} onPick={onPick} />);
        const box = screen.getByRole("combobox");
        expect(box).toHaveAttribute("readonly");
        await userEvent.click(box);
        await userEvent.keyboard("{ArrowDown}{Enter}");
        expect(onPick).toHaveBeenCalledWith("y");
    });

    it("multiple: chips with a remove button, Backspace removes the last, chosen options leave the list", async () => {
        render(<Multi chipLabel={(v) => v.slice(0, 1)} />);
        await userEvent.click(screen.getByRole("combobox"));
        await userEvent.click(screen.getByRole("option", { name: "Beta" }));
        await userEvent.click(screen.getByRole("option", { name: "Gamma" }));
        expect(screen.getByText("b")).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Beta" })).toBeNull();
        await userEvent.keyboard("{Backspace}");
        expect(screen.queryByText("g")).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "removeOption:b" }));
        expect(screen.queryByText("b")).toBeNull();
    });

    it("clearable single mode goes back to nothing; an aria-label names a dropdown without a visible label", async () => {
        const onPick = vi.fn();
        render(<Single clearable ariaLabel="x" label={undefined} onPick={onPick} />);
        expect(screen.getByRole("combobox", { name: "x" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("combobox"));
        await userEvent.click(screen.getByRole("option", { name: "Beta" }));
        await userEvent.click(screen.getByRole("button", { name: "clearSelection" }));
        expect(onPick).toHaveBeenLastCalledWith("");
    });
});
