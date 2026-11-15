// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CheckButton, FeedbackPanel } from "./evaluatedFrame";

describe("CheckButton", () => {
    it("is a submit button named by its label", () => {
        render(<CheckButton label="Check" />);
        expect(screen.getByRole("button", { name: "Check" })).toHaveAttribute("type", "submit");
    });

    it("while loading it is disabled and keeps a name (the spinner's label), not an empty button", () => {
        render(<CheckButton label="Check" loading />);
        const b = screen.getByRole("button", { name: "Loading…" });
        expect(b).toBeDisabled();
        expect(b).not.toHaveTextContent("Check");
    });

    it("can be a plain button with a click handler", async () => {
        const onClick = vi.fn();
        render(<CheckButton label="Check" type="button" onClick={onClick} />);
        await userEvent.click(screen.getByRole("button", { name: "Check" }));
        expect(onClick).toHaveBeenCalled();
    });

    it("holds no block element inside the button (a <p> in a <button> is invalid HTML)", () => {
        const { container } = render(<CheckButton label="Check" />);
        expect(container.querySelector("button p")).toBeNull();
    });
});

describe("FeedbackPanel", () => {
    it("is announced, in the success tone when correct", () => {
        render(<FeedbackPanel correct>Well done</FeedbackPanel>);
        const p = screen.getByRole("status");
        expect(p).toHaveTextContent("Well done");
        expect(p.className).toContain("text-success");
    });

    it("uses the danger tone when not correct", () => {
        render(<FeedbackPanel correct={false}>Try again</FeedbackPanel>);
        expect(screen.getByRole("status").className).toContain("text-danger");
    });
});
