// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RecallGradeButtons from "./recallGradeButtons";

describe("RecallGradeButtons", () => {
    it("sends the grade's score", async () => {
        const onGrade = vi.fn();
        render(<RecallGradeButtons onGrade={onGrade} />);
        await userEvent.click(screen.getByRole("button", { name: /Good/ }));
        expect(onGrade).toHaveBeenCalledWith(0.75);
    });

    it("never disables a grade: the suggestion is only a hint, the user chooses", async () => {
        const onGrade = vi.fn();
        render(<RecallGradeButtons onGrade={onGrade} suggested="hard" />);
        for (const name of [/Again/, /Hard/, /Good/, /Easy/]) expect(screen.getByRole("button", { name })).toBeEnabled();
        await userEvent.click(screen.getByRole("button", { name: /Easy/ }));
        expect(onGrade).toHaveBeenCalledWith(1);
    });

    it("marks the suggested grade with text", () => {
        render(<RecallGradeButtons onGrade={vi.fn()} suggested="good" />);
        expect(screen.getByRole("button", { name: /Good/ })).toHaveTextContent("Suggested");
        expect(screen.getByRole("button", { name: /Easy/ })).not.toHaveTextContent("Suggested");
    });
});
