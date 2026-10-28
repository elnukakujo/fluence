import type { Stroke } from "./strokeData";

function centroid(s: Stroke): { x: number; y: number } {
  const n = s.length || 1;
  let sx = 0;
  let sy = 0;
  for (const p of s) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / n, y: sy / n };
}

function strokeDistance(a: Stroke, b: Stroke): number {
  const ca = centroid(a);
  const cb = centroid(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
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
