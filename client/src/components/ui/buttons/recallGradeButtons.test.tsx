// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RecallGradeButtons from "./recallGradeButtons";

describe("RecallGradeButtons keyboard", () => {
    it("keys 1-4 grade again/hard/good/easy", () => {
        const onGrade = vi.fn();
        render(<RecallGradeButtons onGrade={onGrade} />);
        fireEvent.keyDown(window, { key: "1" }); fireEvent.keyDown(window, { key: "4" });
        expect(onGrade.mock.calls).toEqual([[0], [1]]);
    });
    it("ignores keys typed in a field", () => {
        const onGrade = vi.fn();
        const { container } = render(<><input data-testid="i" /><RecallGradeButtons onGrade={onGrade} /></>);
        fireEvent.keyDown(container.querySelector("input")!, { key: "2" });
        expect(onGrade).not.toHaveBeenCalled();
    });
});
