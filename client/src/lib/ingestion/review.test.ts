import { describe, expect, it } from "vitest";
import {
  type Candidate, countRows, filterRows, initialRows, pageSpan, parsePageRange, rowsByKind, toAcceptItems, warningReasons,
} from "./review";

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  id: "c1", word: "bonjour", translation: "hello", phonetic: null, word_type: null, quote: "bonjour hello",
  page: 3, chunk_id: "p3c0", status: "verified", flags: [], min_conf: null, ...over,
});
const flagged = (code: string, severity: "warning" | "info" = "warning") =>
  cand({ id: code, status: severity === "warning" ? "flagged" : "verified", flags: [{ code, message: `msg ${code}`, severity }] });

describe("initialRows", () => {
  it("pre-selects verified candidates and leaves flagged ones unchecked", () => {
    const rows = initialRows([cand(), flagged("word_not_in_source"), flagged("already_in_lesson")]);
    expect(rows.map((r) => r.selected)).toEqual([true, false, false]);
  });
  it("keeps an info-only note (word exists in the language) selected", () => {
    expect(initialRows([flagged("already_in_language", "info")])[0].selected).toBe(true);
  });
  it("leaves the type empty when the model gave one outside the app's list (e.g. \"v.\")", () => {
    expect(initialRows([cand({ word_type: "v." })])[0].word_type).toBe("");
  });
  it("copies the editable fields and defaults conflicts to keep", () => {
    const [row] = initialRows([cand({ phonetic: null, word_type: "noun" })]);
    expect(row).toMatchObject({ word: "bonjour", translation: "hello", phonetic: "", word_type: "noun", on_conflict: "keep" });
  });
});

describe("filterRows / countRows", () => {
  const rows = initialRows([cand(), flagged("word_not_in_source"), flagged("already_in_language", "info")]);
  it("filters by status", () => {
    expect(filterRows(rows, "all")).toHaveLength(3);
    expect(filterRows(rows, "verified")).toHaveLength(2);
    expect(filterRows(rows, "flagged").map((r) => r.candidate.id)).toEqual(["word_not_in_source"]);
  });
  it("counts totals and the current selection", () => {
    expect(countRows(rows)).toEqual({ total: 3, verified: 2, flagged: 1, selected: 2, deleted: 0 });
  });
  it("leaves deleted rows out of the total and the selection", () => {
    const r = initialRows([cand(), cand({ id: "c2" })]);
    r[1].deleted = true;
    expect(countRows(r)).toEqual({ total: 1, verified: 1, flagged: 0, selected: 1, deleted: 1 });
  });
});

describe("rowsByKind", () => {
  it("groups rows by element kind, vocabulary first, empty kinds absent", () => {
    const r = initialRows([cand({ id: "g", kind: "grammar" }), cand({ id: "v" }), cand({ id: "e", kind: "exercise" })]);
    const g = rowsByKind(r);
    expect(g.map(([k]) => k)).toEqual(["vocabulary", "grammar", "exercise"]);
    expect(g[0][1].map((x) => x.candidate.id)).toEqual(["v"]);
  });

});

describe("warningReasons", () => {
  it("lists only warning-severity messages", () => {
    const c = cand({ status: "flagged", flags: [
      { code: "word_not_in_source", message: "not in source", severity: "warning" },
      { code: "already_in_language", message: "exists", severity: "info" },
    ] });
    expect(warningReasons(c)).toEqual(["not in source"]);
  });
});

describe("toAcceptItems", () => {
  it("sends only selected rows, trimmed, omitting blank optional fields", () => {
    const rows = initialRows([cand(), cand({ id: "c2", word: "merci", status: "flagged" })]);
    rows[0].translation = "  hello  ";
    rows[0].phonetic = "   ";
    expect(toAcceptItems(rows)).toEqual({ items: [{ word: "bonjour", translation: "hello", on_conflict: "keep" }] });
  });
  it("drops a selected row whose word was emptied", () => {
    const rows = initialRows([cand()]);
    rows[0].word = "  ";
    expect(toAcceptItems(rows)).toEqual({ items: [] });
  });
  it("never sends a deleted row", () => {
    const rows = initialRows([cand()]);
    rows[0].deleted = true;
    expect(toAcceptItems(rows)).toEqual({ items: [] });
  });
  it("carries the chosen conflict mode", () => {
    const rows = initialRows([cand()]);
    rows[0].on_conflict = "merge";
    expect(toAcceptItems(rows).items[0].on_conflict).toBe("merge");
  });
});

describe("parsePageRange", () => {
  it("accepts an empty range as 'all pages'", () => {
    expect(parsePageRange("", "")).toEqual({ ok: true, range: null });
  });
  it("accepts a valid range", () => {
    expect(parsePageRange("40", " 55 ")).toEqual({ ok: true, range: [40, 55] });
  });
  it.each([["5", ""], ["", "5"], ["0", "3"], ["9", "3"], ["a", "3"], ["1.5", "3"]])("rejects %s-%s", (a, b) => {
    expect(parsePageRange(a, b).ok).toBe(false);
  });
});

describe("pageSpan", () => {
  it("returns the first and last page of the job's page kinds, or undefined", () => {
    expect(pageSpan({ "22": ["vocabulary"], "30": [], "25": [] })).toEqual([22, 30]);
    expect(pageSpan({})).toBeUndefined();
    expect(pageSpan(null)).toBeUndefined();
  });
});
