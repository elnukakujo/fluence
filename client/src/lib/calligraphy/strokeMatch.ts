import type { Stroke } from "./strokeData";

const SAMPLES = 16;

/** `n` points evenly spaced along the stroke's length: the hand lingers where it starts and rushes at the end, and the reference
 *  medians have few unevenly spaced points, so raw points (or their centroid) say more about the speed than about the shape. */
export function resample(s: Stroke, n = SAMPLES): Stroke {
  if (s.length === 0) return [];
  const cum = [0];
  for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
  const total = cum[cum.length - 1];
  if (total === 0) return Array.from({ length: n }, () => s[0]);
  const out: Stroke = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const at = (total * k) / (n - 1);
    while (seg < s.length - 1 && cum[seg] < at) seg++;
    const span = cum[seg] - cum[seg - 1] || 1;
    const u = Math.min(1, Math.max(0, (at - cum[seg - 1]) / span));
    out.push({ x: s[seg - 1].x + (s[seg].x - s[seg - 1].x) * u, y: s[seg - 1].y + (s[seg].y - s[seg - 1].y) * u });
  }
  return out;
}

const meanGap = (a: Stroke, b: Stroke) => a.reduce((sum, p, i) => sum + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0) / (a.length || 1);

/** How far apart two strokes are in shape and place: the mean gap between their resampled points (either way round: the direction
 *  of the hand is not judged here). Two strokes that cross at one centre have the same centroid, but not the same shape. */
export function strokeDistance(a: Stroke, b: Stroke): number {
  const ra = resample(a);
  const rb = resample(b);
  return Math.min(meanGap(ra, rb), meanGap(ra, [...rb].reverse()));
}

/** Is `stroke` the reference stroke `expected`? Close enough to it, and not clearly closer to another one (a near tie goes to the
 *  expected one: two strokes side by side must not turn a good stroke away). */
export function isExpectedStroke(stroke: Stroke, referenceStrokes: Stroke[], expected: number, maxDistance: number, slack = 30): boolean {
  const target = referenceStrokes[expected];
  if (!target) return false;
  const d = strokeDistance(stroke, target);
  return d < maxDistance && d <= findClosestStroke(stroke, referenceStrokes).distance + slack;
}

export function findClosestStroke(userStroke: Stroke, referenceStrokes: Stroke[]): { index: number; distance: number } {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < referenceStrokes.length; i++) {
    const d = strokeDistance(userStroke, referenceStrokes[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, distance: bestD };
}

export function matchStrokes(
  userStrokes: Stroke[],
  referenceStrokes: Stroke[],
): { similarity: number; strokeOrderErrors: number } {
  if (userStrokes.length === 0) {
    return { similarity: 0, strokeOrderErrors: 0 };
  }

  // Greedily match each user stroke to the closest unused reference stroke.
  const used = new Array(referenceStrokes.length).fill(false);
  const refIndexForUser: number[] = [];
  for (const s of userStrokes) {
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < referenceStrokes.length; j++) {
      if (used[j]) continue;
      const d = strokeDistance(s, referenceStrokes[j]);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best !== -1) used[best] = true;
    refIndexForUser.push(best);
  }

  // Order errors: count of inversions among matched pairs + the count mismatch.
  let orderErrors = Math.abs(userStrokes.length - referenceStrokes.length);
  const matched = refIndexForUser.filter((j) => j !== -1);
  for (let i = 0; i < matched.length; i++) {
    for (let k = i + 1; k < matched.length; k++) {
      if (matched[i] > matched[k]) orderErrors++;
    }
  }

  // Similarity: average per-pair centroid closeness (1 = identical, 0 = far apart).
  // hanzi-writer-data coordinates live in a ~1024-unit box, so 1024 is the scale.
  const sims: number[] = [];
  refIndexForUser.forEach((j, i) => {
    if (j === -1) {
      sims.push(0);
      return;
    }
    sims.push(Math.max(0, 1 - strokeDistance(userStrokes[i], referenceStrokes[j]) / 1024));
  });
  const similarity = sims.reduce((a, b) => a + b, 0) / (sims.length || 1);

  return { similarity, strokeOrderErrors: orderErrors };
}
