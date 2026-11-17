// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProgressRing from "./progressRing";

const offset = (container: HTMLElement) => Number(container.querySelector(".progress-ring-fill")!.getAttribute("stroke-dashoffset"));
const circumference = (container: HTMLElement) => Number(container.querySelector(".progress-ring-fill")!.getAttribute("stroke-dasharray"));

describe("progress ring", () => {
    it("fills the share of the target and names itself for a screen reader", () => {
        const { container } = render(<ProgressRing value={5} max={20} label="5 / 20 answers" size={100} stroke={10} />);
        expect(screen.getByRole("img")).toHaveAccessibleName("5 / 20 answers");
        expect(offset(container)).toBeCloseTo(circumference(container) * 0.75);
    });

    it("never fills past 100 % and never goes negative", () => {
        const over = render(<ProgressRing value={50} max={20} label="x" />);
        expect(offset(over.container)).toBeCloseTo(0);
        const under = render(<ProgressRing value={-3} max={20} label="y" />);
        expect(offset(under.container)).toBeCloseTo(circumference(under.container));
    });

    it("a target of 0 renders an empty ring, not NaN", () => {
        const { container } = render(<ProgressRing value={3} max={0} label="z" />);
        expect(Number.isNaN(offset(container))).toBe(false);
        expect(offset(container)).toBeCloseTo(circumference(container));
    });
});
