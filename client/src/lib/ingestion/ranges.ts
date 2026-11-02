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
