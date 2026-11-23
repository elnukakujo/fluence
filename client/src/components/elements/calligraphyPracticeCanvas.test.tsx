// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ resolve: undefined as undefined | ((v: null) => void) }));
vi.mock("@/lib/calligraphy/strokeData", () => ({ loadStrokeData: () => new Promise((r) => { m.resolve = r; }) }));

import CalligraphyPracticeCanvas from "./calligraphyPracticeCanvas";

describe("calligraphy canvas while the strokes load", () => {
    it("shows a fixed-size skeleton and the card's info, never the words Loading…", () => {
        render(<CalligraphyPracticeCanvas character="水" tier="learning" info={<p>card info</p>} onResult={() => {}} />);
        expect(screen.getByTestId("stroke-skeleton")).toBeInTheDocument();
        expect(screen.getByText("card info")).toBeInTheDocument();
        expect(screen.queryByText(/Loading/)).toBeNull();
    });
});
