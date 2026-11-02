// Page ranges as the user edits them (strings) and as sent to the server ([first, last] pairs). Mirrors the server's normalize_ranges.

export type RangeDraft = { start: string; end: string };
export type PageRangesResult = { ok: true; ranges: [number, number][] | null } | { ok: false; error: string; row: number };

const whole = (s: string) => /^\d+$/.test(s);

/** Blank rows are ignored (all blank -> `ranges: null`); ranges come back sorted. `row` is the offending row's index. */
export function parsePageRanges(rows: RangeDraft[], first = 1, last?: number): PageRangesResult {
  const parsed: { range: [number, number]; row: number }[] = [];
  for (const [row, d] of rows.entries()) {
    const a = d.start.trim(), b = d.end.trim();
    if (!a && !b) continue;
    if (!whole(a) || !whole(b)) return { ok: false, row, error: "Give both the first and the last page as whole numbers" };
    const start = Number(a), end = Number(b);
    if (start < first || end < start || (last !== undefined && end > last)) {
      return { ok: false, row, error: `Pages must be within ${first}-${last ?? "the end"} and end on or after the first page` };
    }
    parsed.push({ range: [start, end], row });
  }
  parsed.sort((x, y) => x.range[0] - y.range[0]);
  for (let i = 1; i < parsed.length; i++) {
    const [p, q] = [parsed[i - 1].range, parsed[i].range];
    if (q[0] <= p[1]) return { ok: false, row: Math.max(parsed[i - 1].row, parsed[i].row), error: `Pages ${p[0]}-${p[1]} and ${q[0]}-${q[1]} overlap` };
  }
  return { ok: true, ranges: parsed.length ? parsed.map((p) => p.range) : null };
}

export const countPages = (ranges: [number, number][]) => ranges.reduce((n, [a, b]) => n + (b - a + 1), 0);

/** "21-28, 45-52": the ranges as people read them (a one-page range is just the page). */
export const formatRanges = (ranges: [number, number][]) => ranges.map(([a, b]) => (a === b ? String(a) : `${a}-${b}`)).join(", ");

/** Every page of the ranges, in order. */
export const expandRanges = (ranges: [number, number][]) => ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));

/** Sorted page numbers -> the ranges they form. */
export function toRanges(pages: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const n of pages) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out;
}

/** A structure lesson's ranges; older jobs only carry start_page / end_page. */
export const lessonRanges = (l: { start_page: number; end_page: number; ranges?: [number, number][] }): [number, number][] =>
  l.ranges?.length ? l.ranges : [[l.start_page, l.end_page]];
