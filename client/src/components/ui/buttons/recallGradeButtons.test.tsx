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

    it("disables the grades above the cap, and they cannot be activated", async () => {
        const onGrade = vi.fn();
        render(<RecallGradeButtons onGrade={onGrade} maxScore={0.75} />);
        const easy = screen.getByRole("button", { name: /Easy/ });
        expect(easy).toBeDisabled();
        easy.focus();
        await userEvent.keyboard("{Enter}");
        await userEvent.click(easy);
        expect(onGrade).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: /Good/ })).toBeEnabled();
    });

    it("marks the suggested grade with text", () => {
        render(<RecallGradeButtons onGrade={vi.fn()} suggested="good" />);
        expect(screen.getByRole("button", { name: /Good/ })).toHaveTextContent("Suggested");
        expect(screen.getByRole("button", { name: /Easy/ })).not.toHaveTextContent("Suggested");
    });
});
