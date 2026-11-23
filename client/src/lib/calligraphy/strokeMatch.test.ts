import { test, expect } from "vitest";
import { matchStrokes, findClosestStroke, isExpectedStroke, resample, strokeDistance } from "./strokeMatch";

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

// two strokes that cross at the same centre, like 十: the same centroid, not the same shape
const horizontal = [{ x: 100, y: 512 }, { x: 512, y: 512 }, { x: 924, y: 512 }];
const vertical = [{ x: 512, y: 100 }, { x: 512, y: 512 }, { x: 512, y: 924 }];
const cross = [horizontal, vertical];
// a hand: many points where it lingers at the start, few at the end, slightly off the line
const hand = (ref: { x: number; y: number }[]) => {
  const a = ref[0], b = ref[ref.length - 1];
  return Array.from({ length: 30 }, (_, i) => { const u = (i / 29) ** 2; return { x: a.x + (b.x - a.x) * u + (i % 2) * 8, y: a.y + (b.y - a.y) * u + 15 }; });
};

test("resample gives n points evenly spaced along the stroke, whatever the speed of the hand", () => {
  const r = resample(hand(horizontal), 5);
  expect(r).toHaveLength(5);
  const gaps = r.slice(1).map((p, i) => Math.hypot(p.x - r[i].x, p.y - r[i].y));
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(40);
});

test("a stroke drawn slow at the start is the expected stroke, even when two strokes share a centre", () => {
  expect(isExpectedStroke(hand(horizontal), cross, 0, 180)).toBe(true);
  expect(isExpectedStroke(hand(vertical), cross, 1, 180)).toBe(true);
});

test("the other stroke through the same centre is turned away", () => {
  expect(isExpectedStroke(hand(vertical), cross, 0, 180)).toBe(false);
  expect(isExpectedStroke(hand(horizontal), cross, 1, 180)).toBe(false);
});

test("the direction of the hand is not judged", () => {
  expect(isExpectedStroke([...hand(horizontal)].reverse(), cross, 0, 180)).toBe(true);
  expect(strokeDistance(horizontal, [...horizontal].reverse())).toBeCloseTo(0);
});

test("a stroke far from the expected one is turned away", () => {
  const far = horizontal.map((p) => ({ x: p.x, y: p.y - 400 }));
  expect(isExpectedStroke(far, cross, 0, 180)).toBe(false);
});

test("two strokes side by side: a good stroke is not turned away because the next one is a hair closer", () => {
  const upper = [{ x: 100, y: 400 }, { x: 924, y: 400 }];
  const lower = [{ x: 100, y: 470 }, { x: 924, y: 470 }];
  expect(isExpectedStroke(hand([{ x: 100, y: 420 }, { x: 924, y: 420 }]), [upper, lower], 0, 180)).toBe(true);
});

test("a tap (one point) does not throw", () => {
  expect(isExpectedStroke([{ x: 5, y: 5 }], cross, 0, 180)).toBe(false);
});
