// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SectionCard from "./sectionCard";

describe("SectionCard", () => {
    it("is a titled article holding its content", () => {
        render(<SectionCard title="Backups"><p>body</p></SectionCard>);
        expect(screen.getByRole("heading", { level: 2, name: "Backups" })).toBeInTheDocument();
        expect(screen.getByRole("article")).toHaveTextContent("body");
    });
});
