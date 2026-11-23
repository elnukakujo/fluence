// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const strokes = [
    [{ x: 100, y: 200 }, { x: 512, y: 200 }, { x: 924, y: 200 }],       // 1: across
    [{ x: 512, y: 100 }, { x: 512, y: 512 }, { x: 512, y: 924 }],       // 2: down
];
vi.mock("@/lib/calligraphy/strokeData", () => ({ loadStrokeData: () => Promise.resolve(strokes) }));

import CalligraphyPracticeCanvas from "./calligraphyPracticeCanvas";

const NEXT_STROKE = "rgba(37,99,235,0.6)";     // the blue next stroke
const used: string[] = [];
const ctx = new Proxy({ set strokeStyle(v: string) { used.push(v); } } as unknown as CanvasRenderingContext2D, {
    get: (t, k) => (k in t ? (t as never)[k] : () => undefined),
    set: (t, k, v) => { if (k === "strokeStyle") used.push(v); return true; },
});
HTMLCanvasElement.prototype.getContext = (() => ctx) as never;

const draw = (canvas: HTMLElement, points: [number, number][]) => {   // canvas pixels (300 x 300 = 1024 / 3.41)
    const at = ([x, y]: [number, number]) => ({ clientX: x * 300 / 1024, clientY: y * 300 / 1024 });
    fireEvent.pointerDown(canvas, at(points[0]));
    points.slice(1).forEach((p) => fireEvent.pointerMove(canvas, at(p)));
    fireEvent.pointerUp(canvas);
};
const setup = (tier: "learning" | "practising" | "maintaining") => {
    used.length = 0;
    const view = render(<CalligraphyPracticeCanvas character="大" tier={tier} onResult={() => {}} />);
    return view;
};
const canvasOf = async (container: HTMLElement) => {
    const canvas = await waitFor(() => { const c = container.querySelector("canvas"); expect(c).not.toBeNull(); return c as HTMLCanvasElement; });
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
    return canvas;
};

describe("the guide fades with the level", () => {
    it("a learning character gets the next stroke lit in blue", async () => {
        const { container } = setup("learning");
        await canvasOf(container);
        expect(used).toContain(NEXT_STROKE);
    });
    it("a known (practising) character gets the plain outline, with no blue next stroke", async () => {
        const { container } = setup("practising");
        await canvasOf(container);
        expect(used).toContain("rgba(0,0,0,0.18)");        // the faint outline
        expect(used).not.toContain(NEXT_STROKE);
    });
    it("a mastered character gets no guide at all", async () => {
        const { container } = setup("maintaining");
        await canvasOf(container);
        expect(used).not.toContain("rgba(0,0,0,0.18)");
        expect(used).not.toContain(NEXT_STROKE);
    });
});

describe("the strokes are judged one after the other", () => {
    it("takes a hand-drawn first stroke, refuses a second stroke drawn first", async () => {
        const { container } = setup("practising");
        const canvas = await canvasOf(container);
        draw(canvas, [[600, 230], [700, 215], [924, 190]]);                 // the second stroke is drawn first: down, not across
        draw(canvas, [[500, 120], [515, 400], [510, 900]]);
        expect(screen.getByText(/Strokes: 0/)).toBeInTheDocument();
        draw(canvas, [[110, 215], [120, 205], [300, 200], [520, 195], [930, 205]]);
        expect(screen.getByText(/Strokes: 1 \/ 2/)).toBeInTheDocument();
    });
});

describe("a new card", () => {
    it("starts again when the canvas is mounted for another card with the same character (the renderer keys it by card)", async () => {
        const { container, rerender } = render(<CalligraphyPracticeCanvas key="call_1" character="大" tier="practising" onResult={() => {}} />);
        const canvas = await canvasOf(container);
        draw(canvas, [[110, 215], [300, 200], [930, 205]]);
        expect(screen.getByText(/Strokes: 1 \/ 2/)).toBeInTheDocument();
        rerender(<CalligraphyPracticeCanvas key="call_2" character="大" tier="practising" onResult={() => {}} />);
        await waitFor(() => expect(screen.getByText(/Strokes: 0 \/ 2/)).toBeInTheDocument());
    });
});
