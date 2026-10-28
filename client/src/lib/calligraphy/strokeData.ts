export type Point = { x: number; y: number };
export type Stroke = Point[];

// hanzi-writer-data is a per-character JSON package; loading an arbitrary
// user-entered character requires a runtime fetch rather than a static import.
// ponytail: CDN fetch for now; bundle the needed characters locally if offline
// use ever matters.
const DATA_BASE = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1";

export async function loadStrokeData(character: string): Promise<Stroke[] | null> {
  try {
    const res = await fetch(`${DATA_BASE}/${encodeURIComponent(character)}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.medians) return null;
    const strokes = data.medians.map((pts: number[][]) => pts.map(([x, y]) => ({ x, y })));
    // hanzi-writer-data is Y-up (0 = bottom); the canvas is Y-down (0 = top).
    return normalizeStrokes(flipStrokesY(strokes));
  } catch {
    return null;
  }
}

// Reflect Y around the bounding-box center (Y-up data → Y-down canvas).
export function flipStrokesY(strokes: Stroke[]): Stroke[] {
  if (strokes.length === 0) return strokes;
  let minY = Infinity, maxY = -Infinity;
  for (const s of strokes) {
    for (const p of s) {
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  const cy = (minY + maxY) / 2;
  return strokes.map((s) => s.map((p) => ({ x: p.x, y: 2 * cy - p.y })));
}

// Center + scale into a 1024 box (no Y flip — callers decide the axis).
export function normalizeStrokes(strokes: Stroke[]): Stroke[] {
  if (strokes.length === 0) return strokes;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    for (const p of s) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const scale = Math.min(1024 / width, 1024 / height) * 0.8;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return strokes.map((s) => s.map((p) => ({
    x: (p.x - cx) * scale + 512,
    y: (p.y - cy) * scale + 512,
  })));
}
