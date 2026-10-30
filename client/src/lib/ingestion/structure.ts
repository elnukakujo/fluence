// Pure helpers for the "which lessons are in this book?" step (no React, unit-tested).

export type ProposedLesson = {
  index: number; title: string; start_page: number; end_page: number; verified: boolean | null; note: string | null;
};

export type Draft = { include: boolean; title: string; start: string; end: string; verified: boolean | null; note: string | null };

export function draftsFromProposal(lessons: ProposedLesson[]): Draft[] {
  return lessons.map((l) => ({
    include: true, title: l.title, start: String(l.start_page), end: String(l.end_page), verified: l.verified, note: l.note,
  }));
}

const whole = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : null);

/** Mirrors the server's validate_structure for the included lessons; returns a reason or null. */
export function validateDrafts(drafts: Draft[], first: number, last: number): string | null {
  const chosen = drafts.filter((d) => d.include);
  if (chosen.length === 0) return "Select at least one lesson";
  const spans: { title: string; start: number; end: number }[] = [];
  for (const d of chosen) {
    const title = d.title.trim();
    if (!title) return "Every lesson needs a title";
    const start = whole(d.start), end = whole(d.end);
    if (start === null || end === null) return `“${title}”: pages must be whole numbers`;
    if (start < first || end > last || end < start) return `“${title}”: pages must be within ${first}-${last}, ending on or after the first page`;
    spans.push({ title, start, end });
  }
  spans.sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].start <= spans[i - 1].end) return `“${spans[i - 1].title}” and “${spans[i].title}” overlap`;
  }
  return null;
}

export function toConfirmPayload(drafts: Draft[]) {
  return drafts.filter((d) => d.include).map((d) => ({ title: d.title.trim(), start_page: Number(d.start), end_page: Number(d.end) }));
}

/** Upper bound on model calls: one per page of the included lessons (pages without text cost nothing). */
export function estimateCalls(drafts: Draft[]): number {
  return drafts.reduce((sum, d) => {
    const start = whole(d.start), end = whole(d.end);
    return d.include && start !== null && end !== null && end >= start ? sum + (end - start + 1) : sum;
  }, 0);
}

export function addDraft(drafts: Draft[], lastPage: number): Draft[] {
  const ends = drafts.map((d) => whole(d.end) ?? 0);
  const start = Math.min((ends.length ? Math.max(...ends) : 0) + 1, lastPage);
  return [...drafts, { include: true, title: "", start: String(start), end: String(lastPage), verified: null, note: null }];
}

export function removeDraft(drafts: Draft[], position: number): Draft[] {
  return drafts.filter((_, i) => i !== position);
}
