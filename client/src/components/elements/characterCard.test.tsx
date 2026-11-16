// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("./elementMediaCard", () => ({ default: () => null }));

import CharacterCard from "./characterCard";

describe("CharacterCard", () => {
    it("lists components and used-in characters as links to their pages", () => {
        render(<CharacterCard character={{ character: "河" }} languageId="lang_1"
            components={[{ id: "char_2", character: "氵" }]} radicalOf={[{ id: "char_9", character: "湖" }]} />);
        expect(screen.getByText("characterComponents")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "氵" })).toHaveAttribute("href", "/languages/lang_1/character/char_2");
        expect(screen.getByRole("link", { name: "湖" })).toHaveAttribute("href", "/languages/lang_1/character/char_9");
    });

    it("states that a character is also a radical or a component, as plain badges", () => {
        const { rerender } = render(<CharacterCard character={{ character: "氵" }} languageId="lang_1" radicalOf={[{ id: "c1", character: "河" }]} />);
        expect(screen.getByText("characterRadicalBadge")).toBeInTheDocument();
        expect(screen.queryByText("characterComponentBadge")).toBeNull();
        expect(screen.queryByRole("link", { name: "characterRadicalBadge" })).toBeNull();
        expect(screen.getByText("characterRadicalOf")).toBeInTheDocument();
        rerender(<CharacterCard character={{ character: "可" }} languageId="lang_1" componentOf={[{ id: "c1", character: "河" }]} />);
        expect(screen.getByText("characterComponentBadge")).toBeInTheDocument();
        expect(screen.getByText("characterComponentOf")).toBeInTheDocument();
        rerender(<CharacterCard character={{ character: "河" }} languageId="lang_1" />);
        expect(screen.queryByText("characterRadicalBadge")).toBeNull();
    });

    it("shows no section when there is nothing to list", () => {
        render(<CharacterCard character={{ character: "水" }} languageId="lang_1" components={[]} />);
        expect(screen.queryByText("characterComponents")).toBeNull();
    });

    it("shows the key radical as a labelled link instead of the plain text badge", () => {
        render(<CharacterCard character={{ character: "放", radical: "方" }} languageId="lang_1" keyRadical={{ id: "char_7", character: "方" }} />);
        expect(screen.getByRole("link", { name: "方" })).toHaveAttribute("href", "/languages/lang_1/character/char_7");
        expect(screen.getByText("characterKeyRadical").tagName).toBe("DT");
        expect(screen.getAllByText("方")).toHaveLength(1);       // not repeated as a badge
    });

    it("keeps the plain text badge while the radical is not linked", () => {
        render(<CharacterCard character={{ character: "放", radical: "方" }} languageId="lang_1" />);
        expect(screen.getByText("方")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "方" })).toBeNull();
    });
});
