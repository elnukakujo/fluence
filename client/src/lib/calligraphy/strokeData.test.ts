import { test, expect } from "vitest";
import { normalizeStrokes } from "./strokeData";

test("normalizeStrokes centers a stroke's bounding box at the canvas origin", () => {
  const strokes = [[{ x: 0, y: 0 }, { x: 100, y: 100 }]];
  const out = normalizeStrokes(strokes);
  const cx = (out[0][0].x + out[0][1].x) / 2;
  const cy = (out[0][0].y + out[0][1].y) / 2;
  expect(cx).toBeCloseTo(512, 0);
  expect(cy).toBeCloseTo(512, 0);
});
