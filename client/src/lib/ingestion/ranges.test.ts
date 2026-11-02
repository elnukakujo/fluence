import { describe, expect, it } from "vitest";
import { countPages, expandRanges, formatRanges, parsePageRanges, toRanges } from "./ranges";

const r = (start: string, end: string) => ({ start, end });

describe("parsePageRanges", () => {
  it("returns null ranges when every row is blank", () => {
    expect(parsePageRanges([r("", ""), r(" ", "")])).toEqual({ ok: true, ranges: null });
  });
  it("sorts ranges and ignores blank rows", () => {
    expect(parsePageRanges([r("40", " 55 "), r("", ""), r("3", "5")])).toEqual({ ok: true, ranges: [[3, 5], [40, 55]] });
  });
  it("allows touching ranges", () => {
    expect(parsePageRanges([r("1", "5"), r("6", "9")])).toEqual({ ok: true, ranges: [[1, 5], [6, 9]] });
  });
  it.each([
    ["half filled", [r("5", "")], 0],
    ["not a number", [r("a", "3")], 0],
    ["page 0", [r("0", "3")], 0],
    ["end before start", [r("9", "3")], 0],
    ["overlap reports the later row", [r("1", "5"), r("5", "9")], 1],
    ["past the document", [r("1", "99")], 0],
  ])("rejects %s and names the row", (_, rows, row) => {
    const out = parsePageRanges(rows, 1, 20);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.row).toBe(row);
  });
});

describe("countPages", () => {
  it("sums the pages of all ranges", () => expect(countPages([[1, 3], [10, 11]])).toBe(5));
});

describe("formatRanges / expandRanges / toRanges", () => {
  it("writes ranges the way people read them", () => {
    expect(formatRanges([[21, 28], [45, 52]])).toBe("21-28, 45-52");
    expect(formatRanges([[5, 5], [9, 10]])).toBe("5, 9-10");
    expect(formatRanges([])).toBe("");
  });
  it("expands to the pages in order and compresses back", () => {
    expect(expandRanges([[1, 2], [5, 5]])).toEqual([1, 2, 5]);
    expect(toRanges([1, 2, 5, 7, 8])).toEqual([[1, 2], [5, 5], [7, 8]]);
    expect(toRanges([])).toEqual([]);
  });
});
