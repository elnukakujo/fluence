import { test, expect } from "vitest";
import { matchStrokes, findClosestStroke } from "./strokeMatch";

test("identical strokes give similarity 1 and zero order errors", () => {
  const s = [[{ x: 0, y: 0 }, { x: 10, y: 10 }]];
  expect(matchStrokes(s, s)).toEqual({ similarity: 1, strokeOrderErrors: 0 });
});

test("reversed stroke order counts order errors", () => {
  const ref = [
    [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    [{ x: 0, y: 20 }, { x: 10, y: 20 }],
  ];
  const user = [
    [{ x: 0, y: 20 }, { x: 10, y: 20 }],
    [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  ];
  expect(matchStrokes(user, ref).strokeOrderErrors).toBeGreaterThan(0);
});

test("stroke count mismatch does not throw", () => {
  const user = [[{ x: 0, y: 0 }, { x: 10, y: 10 }]];
  const ref = [[{ x: 0, y: 0 }, { x: 10, y: 10 }], [{ x: 20, y: 20 }, { x: 30, y: 30 }]];
  const r = matchStrokes(user, ref);
  expect(r.strokeOrderErrors).toBeGreaterThanOrEqual(1);
  expect(Number.isNaN(r.similarity)).toBe(false);
});

test("empty user strokes give similarity 0 and no throw", () => {
  expect(matchStrokes([], [[{ x: 0, y: 0 }, { x: 10, y: 10 }]])).toEqual({ similarity: 0, strokeOrderErrors: 0 });
});

test("findClosestStroke returns the closest reference stroke index and distance", () => {
  const ref = [
    [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    [{ x: 0, y: 100 }, { x: 10, y: 100 }],
  ];
  const stroke = [{ x: 0, y: 98 }, { x: 10, y: 98 }];
  const { index, distance } = findClosestStroke(stroke, ref);
  expect(index).toBe(1);
  expect(distance).toBeLessThan(10);
});
