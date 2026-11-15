// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AutoWidthInput from "./autoWidthInput";

describe("AutoWidthInput", () => {
    it("wires its visible label to its input", () => {
        render(<AutoWidthInput label="Word" value="" onChange={() => {}} />);
        expect(screen.getByLabelText("Word")).toBeInstanceOf(HTMLInputElement);
    });

    it("two inputs with the same label stay separately labelled", () => {
        render(<><AutoWidthInput label="Example Sentence" value="a" onChange={() => {}} /><AutoWidthInput label="Example Sentence" value="b" onChange={() => {}} /></>);
        const inputs = screen.getAllByLabelText("Example Sentence") as HTMLInputElement[];
        expect(inputs).toHaveLength(2);
        expect(inputs[0].id).not.toBe(inputs[1].id);
        expect(inputs.map((i) => i.value)).toEqual(["a", "b"]);
    });

    it("keeps an id the caller passes", () => {
        render(<AutoWidthInput label="Word" value="" onChange={() => {}} {...({ id: "mine" } as object)} />);
        expect(screen.getByLabelText("Word").id).toBe("mine");
    });
});
