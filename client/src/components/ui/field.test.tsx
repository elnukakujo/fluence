// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Field from "./field";

describe("Field", () => {
    it("wires its label to the control it wraps", () => {
        render(<Field label="Title"><input className="input" /></Field>);
        expect(screen.getByLabelText("Title")).toBeInstanceOf(HTMLInputElement);
    });

    it("works for a select and a textarea too", () => {
        render(<><Field label="Type"><select><option>a</option></select></Field><Field label="Notes"><textarea /></Field></>);
        expect(screen.getByLabelText("Type")).toBeInstanceOf(HTMLSelectElement);
        expect(screen.getByLabelText("Notes")).toBeInstanceOf(HTMLTextAreaElement);
    });

    it("references the hint and the error from the control with aria-describedby, and marks it invalid", () => {
        render(<Field label="Email" hint="We never share it" error="Not an email"><input /></Field>);
        const input = screen.getByLabelText("Email");
        expect(input).toHaveAttribute("aria-invalid", "true");
        const described = input.getAttribute("aria-describedby")!.split(" ");
        expect(described).toHaveLength(2);
        expect(document.getElementById(described[0])).toHaveTextContent("We never share it");
        expect(document.getElementById(described[1])).toHaveTextContent("Not an email");
    });

    it("keeps the error out of the label, so the control's accessible name stays the label", () => {
        render(<Field label="Email" error="Not an email"><input /></Field>);
        expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Not an email");
    });

    it("not invalid and not described when there is neither hint nor error", () => {
        render(<Field label="Title"><input /></Field>);
        const input = screen.getByLabelText("Title");
        expect(input).not.toHaveAttribute("aria-invalid");
        expect(input).not.toHaveAttribute("aria-describedby");
    });

    it("keeps an id the control already has", () => {
        render(<Field label="Title"><input id="mine" /></Field>);
        expect(screen.getByLabelText("Title")).toHaveAttribute("id", "mine");
    });
});
