// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Spinner from "./spinner";

describe("Spinner", () => {
    it("is a status with an accessible name, so a loading button is never nameless", () => {
        render(<button disabled><Spinner /></button>);
        expect(screen.getByRole("status")).toHaveTextContent("Loading…");
        expect(screen.getByRole("button", { name: "Loading…" })).toBeInTheDocument();
    });

    it("takes a custom label", () => {
        render(<Spinner label="Saving" />);
        expect(screen.getByRole("status")).toHaveTextContent("Saving");
    });

    it("has a static twin for prefers-reduced-motion (swapped by CSS), both hidden from assistive tech", () => {
        const { container } = render(<Spinner />);
        const motion = container.querySelector(".spinner-motion");
        const still = container.querySelector(".spinner-static");
        expect(motion).toHaveAttribute("aria-hidden", "true");
        expect(still).toHaveAttribute("aria-hidden", "true");
    });

    it("inherits the surrounding text colour by default", () => {
        const { container } = render(<Spinner />);
        expect(container.querySelector("l-ring")?.getAttribute("color") ?? "currentColor").toMatch(/currentColor/i);
    });
});
