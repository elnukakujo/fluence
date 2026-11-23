// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ActionBar from "./ActionBar";

describe("ActionBar", () => {
    it("holds the grading controls before grading, with no Next", () => {
        render(<ActionBar phase="grade"><button>Good</button></ActionBar>);
        expect(screen.getByRole("button", { name: "Good" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
        expect(screen.getByTestId("action-bar").className).toMatch(/fixed/);
    });
    it("after grading shows the result strip over a Next button; the strip is polite", async () => {
        const onNext = vi.fn();
        render(<ActionBar phase="next" onNext={onNext} result={{ gradeLabel: "Good", before: 40, after: 58, levelUp: false }} />);
        expect(screen.getByTestId("result-strip")).toHaveTextContent("Good40 → 58");
        expect(screen.getByTestId("result-strip")).toHaveAttribute("aria-live", "polite");
        expect(screen.queryByTestId("level-up")).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(onNext).toHaveBeenCalledTimes(1);
    });
    it("marks a level up only when the card crossed a level", () => {
        render(<ActionBar phase="next" onNext={() => {}} result={{ gradeLabel: "Easy", before: 55, after: 64, levelUp: true }} />);
        expect(screen.getByTestId("level-up")).toHaveTextContent("Level up");
    });
    it("Enter and Space move on, but not while typing in a field", async () => {
        const onNext = vi.fn();
        render(<><input aria-label="note" /><ActionBar phase="next" onNext={onNext} result={null} /></>);
        (document.activeElement as HTMLElement)?.blur?.();
        await userEvent.keyboard("{Enter}");
        await userEvent.keyboard(" ");
        expect(onNext).toHaveBeenCalledTimes(2);
        await userEvent.click(screen.getByLabelText("note"));
        await userEvent.keyboard("{Enter}");
        expect(onNext).toHaveBeenCalledTimes(2);
    });
    it("shows custom children in the next phase instead of the default Next (an exercise's own footer)", () => {
        render(<ActionBar phase="next"><button>I was right</button></ActionBar>);
        expect(screen.getByRole("button", { name: "I was right" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    });
});
