import { describe, expect, it } from "vitest";
import { type Draft, addDraft, draftsFromProposal, estimateCalls, removeDraft, toConfirmPayload, validateDrafts } from "./structure";

const proposal = [
  { index: 0, title: "Lesson 1", start_page: 3, end_page: 9, verified: true, note: null },
  { index: 1, title: "Lesson 2", start_page: 10, end_page: 20, verified: false, note: "check it" },
];

describe("draftsFromProposal", () => {
  it("includes every lesson and carries verification info", () => {
    const d = draftsFromProposal(proposal);
    expect(d.map((x) => [x.include, x.title, x.start, x.end, x.verified])).toEqual([
      [true, "Lesson 1", "3", "9", true], [true, "Lesson 2", "10", "20", false]]);
    expect(d[1].note).toBe("check it");
  });
});

describe("validateDrafts", () => {
  const ok = (): Draft[] => draftsFromProposal(proposal);
  it("accepts a valid structure", () => expect(validateDrafts(ok(), 1, 25)).toBeNull());
  it("ignores excluded lessons", () => {
    const d = ok();
    d[1].include = false;
    d[1].title = "";
    expect(validateDrafts(d, 1, 25)).toBeNull();
  });
  it.each([
    ["no lessons selected", (d: Draft[]) => d.forEach((x) => (x.include = false))],
    ["empty title", (d: Draft[]) => (d[0].title = "  ")],
    ["non-numeric page", (d: Draft[]) => (d[0].start = "x")],
    ["end before start", (d: Draft[]) => (d[0].end = "2")],
    ["outside the document", (d: Draft[]) => (d[1].end = "99")],
    ["overlap", (d: Draft[]) => (d[0].end = "10")],
  ])("rejects %s", (_, mutate) => {
    const d = ok();
    mutate(d);
    expect(validateDrafts(d, 1, 25)).toBeTruthy();
  });
});

describe("toConfirmPayload", () => {
  it("sends only included lessons, trimmed, with numeric pages", () => {
    const d = draftsFromProposal(proposal);
    d[0].title = "  Salutations ";
    d[1].include = false;
    expect(toConfirmPayload(d)).toEqual([{ title: "Salutations", start_page: 3, end_page: 9 }]);
  });
});

describe("estimateCalls", () => {
  it("is the number of pages in the included lessons (an upper bound: empty pages cost nothing)", () => {
    const d = draftsFromProposal(proposal);
    expect(estimateCalls(d)).toBe(7 + 11);
    d[1].include = false;
    expect(estimateCalls(d)).toBe(7);
  });
  it("ignores unparseable rows", () => {
    const d = draftsFromProposal(proposal);
    d[0].start = "x";
    expect(estimateCalls(d)).toBe(11);
  });
});

describe("add/remove", () => {
  it("adds a lesson after the last one, starting on the next page", () => {
    const d = addDraft(draftsFromProposal(proposal), 25);
    expect(d).toHaveLength(3);
    expect(d[2]).toMatchObject({ include: true, title: "", start: "21", end: "25" });
  });
  it("removes by position", () => {
    expect(removeDraft(draftsFromProposal(proposal), 0).map((x) => x.title)).toEqual(["Lesson 2"]);
  });
});
