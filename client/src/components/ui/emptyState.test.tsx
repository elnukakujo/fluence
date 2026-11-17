// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmptyState from "./emptyState";

describe("EmptyState", () => {
    it("shows the message in the muted text colour (never an opacity trick that fails contrast)", () => {
        render(<EmptyState>Nothing here</EmptyState>);
        const el = screen.getByText("Nothing here");
        expect(el).toHaveClass("text-muted");
        expect(el.className).not.toMatch(/opacity-/);
    });

    it("can carry a hint and an action, so the empty state says what to do next", () => {
        render(<EmptyState hint="Create one to start" action={<button type="button">Create</button>}>No backups</EmptyState>);
        expect(screen.getByText("Create one to start")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    });

    it("keeps the caller's layout classes", () => {
        const { container } = render(<EmptyState className="index-divider pt-3">x</EmptyState>);
        expect(container.firstElementChild).toHaveClass("index-divider", "pt-3");
    });
});
