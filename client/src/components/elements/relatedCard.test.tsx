// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

import RelatedCard from "./relatedCard";

describe("RelatedCard", () => {
    it("lists radicals as their own group of links to the radical's sheet", () => {
        render(<RelatedCard languageId="lang_1" characters={[{ id: "c1", character: "河" }]} radicals={[{ id: "c3", character: "氵" }]} />);
        expect(screen.getByText("relatedRadicals")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "氵" })).toHaveAttribute("href", "/languages/lang_1/character/c3");
        expect(screen.getByRole("link", { name: "河" })).toHaveAttribute("href", "/languages/lang_1/character/c1");
    });

    it("has no radicals group when there are none", () => {
        render(<RelatedCard languageId="lang_1" characters={[{ id: "c1", character: "河" }]} />);
        expect(screen.queryByText("relatedRadicals")).toBeNull();
    });
});
