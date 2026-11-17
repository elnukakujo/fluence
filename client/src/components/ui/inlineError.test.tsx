// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InlineError from "./inlineError";

describe("InlineError", () => {
    it("is announced as an alert and uses the semantic danger colour, not a raw one", () => {
        render(<InlineError>Could not save</InlineError>);
        const el = screen.getByRole("alert");
        expect(el).toHaveTextContent("Could not save");
        expect(el).toHaveClass("text-danger");
        expect(el.className).not.toMatch(/red-\d/);
    });

    it("never relies on colour alone: a decorative icon accompanies the text", () => {
        const { container } = render(<InlineError>Could not save</InlineError>);
        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("keeps the caller's layout classes", () => {
        render(<InlineError className="mt-2">x</InlineError>);
        expect(screen.getByRole("alert")).toHaveClass("mt-2");
    });
});
