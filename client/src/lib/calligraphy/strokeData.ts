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
    return data.medians.map((pts: number[][]) => pts.map(([x, y]) => ({ x, y })));
  } catch {
    return null;
  }
}
