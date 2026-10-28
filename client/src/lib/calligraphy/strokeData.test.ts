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

test("normalizeStrokes flips the Y axis (data is Y-up, canvas is Y-down)", () => {
  // y=100 is the top of the character (larger Y in Y-up data), y=0 is the bottom.
  const strokes = [[{ x: 0, y: 100 }, { x: 0, y: 0 }]];
  const out = normalizeStrokes(strokes);
  expect(out[0][0].y).toBeLessThan(out[0][1].y);
});
