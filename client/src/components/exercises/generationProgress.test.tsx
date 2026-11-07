// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GenerationProgress from "./generationProgress";

describe("GenerationProgress", () => {
    it("is a determinate progress bar with its numbers as text", () => {
        render(<GenerationProgress done={3} total={12} />);
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "3");
        expect(bar).toHaveAttribute("aria-valuemax", "12");
        expect(screen.getByRole("status")).toHaveTextContent("Writing exercises… 3 / 12");
        expect(screen.getByText("25%")).toBeInTheDocument();
    });

    it("says it is starting before the first exercise is written, with an indeterminate bar", () => {
        render(<GenerationProgress done={0} total={12} />);
        expect(screen.getByRole("status")).toHaveTextContent("Starting…");
        expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    });

    it("once every slot is written it says it is checking and saving, not that it is finished", () => {
        render(<GenerationProgress done={12} total={12} />);
        expect(screen.getByRole("status")).toHaveTextContent("Checking and saving…");
        expect(screen.queryByText("100%")).toBeNull();
    });

    it("the moving highlight is a class the stylesheet turns off for reduced motion", () => {
        render(<GenerationProgress done={1} total={4} />);
        expect(document.querySelector(".gen-progress-fill")).toHaveClass("is-active");
    });
});
