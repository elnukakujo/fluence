// Pure helpers for the "which lessons are in this book?" step (no React, unit-tested).
import { type RangeDraft, countPages, parsePageRanges } from "./ranges";

export type ProposedLesson = {
  index: number; title: string; start_page: number; end_page: number; verified: boolean | null; note: string | null;
  ranges?: [number, number][];
};

export type Draft = { include: boolean; title: string; ranges: RangeDraft[]; verified: boolean | null; note: string | null };

export function draftsFromProposal(lessons: ProposedLesson[]): Draft[] {
  return lessons.map((l) => ({
    include: true, title: l.title, verified: l.verified, note: l.note,
    ranges: (l.ranges ?? [[l.start_page, l.end_page]]).map(([a, b]) => ({ start: String(a), end: String(b) })),
  }));
}

/** Mirrors the server's validate_structure for the included lessons; returns a reason or null. */
export function validateDrafts(drafts: Draft[], first: number, last: number): string | null {
  const chosen = drafts.filter((d) => d.include);
  if (chosen.length === 0) return "Select at least one lesson";
  const spans: { title: string; start: number; end: number }[] = [];
  for (const d of chosen) {
    const title = d.title.trim();
    if (!title) return "Every lesson needs a title";
    const parsed = parsePageRanges(d.ranges, first, last);
    if (!parsed.ok) return `“${title}”: ${parsed.error}`;
    if (!parsed.ranges) return `“${title}”: give at least one page range`;
    for (const [start, end] of parsed.ranges) spans.push({ title, start, end });
  }
  spans.sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].start <= spans[i - 1].end) {
      return spans[i].title === spans[i - 1].title ? `“${spans[i].title}” has overlapping ranges` : `“${spans[i - 1].title}” and “${spans[i].title}” overlap`;
    }
  }
  return null;
}

/** The included lessons' valid ranges, or [] when the rows are not (yet) valid. */
export function draftRanges(d: Draft): [number, number][] {
  const parsed = parsePageRanges(d.ranges);
  return parsed.ok && parsed.ranges ? parsed.ranges : [];
}

export function toConfirmPayload(drafts: Draft[]) {
  return drafts.filter((d) => d.include).map((d) => ({ title: d.title.trim(), ranges: draftRanges(d) }));
}

/** Upper bound on model calls: one per page of the included lessons (pages without text cost nothing). */
export function estimateCalls(drafts: Draft[]): number {
  return drafts.reduce((sum, d) => (d.include ? sum + countPages(draftRanges(d)) : sum), 0);
}

export function addDraft(drafts: Draft[], lastPage: number): Draft[] {
  const ends = drafts.flatMap((d) => d.ranges.map((r) => (/^\d+$/.test(r.end.trim()) ? Number(r.end) : 0)));
  const start = Math.min((ends.length ? Math.max(...ends) : 0) + 1, lastPage);
  return [...drafts, { include: true, title: "", ranges: [{ start: String(start), end: String(lastPage) }], verified: null, note: null }];
}

export function removeDraft(drafts: Draft[], position: number): Draft[] {
  return drafts.filter((_, i) => i !== position);
}
