// Pure helpers for the import review screen (no React, unit-tested).

export type Flag = { code: string; message: string; severity: "warning" | "info" };

export type Candidate = {
  id: string;
  word?: string;
  translation?: string | null;
  phonetic?: string | null;
  word_type?: string | null;
  quote: string;
  page: number; // 0-based document page
  page_end?: number; // last page, when a merged point spans several
  chunk_id: string;
  status: "verified" | "flagged";
  flags: Flag[];
  min_conf: number | null;
  existing?: Record<string, string | number | boolean | null> | null; // what the app already holds for this item
  // For non-vocabulary elements
  kind?: "grammar" | "calligraphy" | "exercise";
  title?: string;
  explanation?: string;
  character?: string;
  meaning?: string;
  radical?: string | null;
  strokes?: string | null;
  example_sentences?: string[];
  original_text?: string; // OCR text for grammar candidates
  // For exercise
  exercise_type?: string;
  question?: string;
  answer?: string;
  text_support?: string | null;
  content?: Record<string, unknown> | null;
};

// Same list as the server's WordDict validator; "" means not given.
export const WORD_TYPES = ["", "noun", "verb", "adjective", "adverb", "pronoun", "article", "preposition", "conjunction",
  "particle", "interjection", "numeral", "classifier", "auxiliary", "modal", "sentence"] as const;

export type ConflictMode = "keep" | "merge" | "overwrite";

export type Row = {
  candidate: Candidate;
  selected: boolean; // confirmed: sent on Add
  deleted?: boolean; // dropped by the user; never sent, can be undone
  // editable copies, so the user can fix a word without losing what the model said
  word?: string;
  translation?: string;
  phonetic?: string;
  word_type?: string;
  on_conflict: ConflictMode | null; // null = a conflicting card the user has not decided yet
  merged?: boolean; // the result was chosen in the merge editor
  // For non-vocabulary elements
  title?: string;
  explanation?: string;
  character?: string;
  meaning?: string;
  radical?: string | null;
  strokes?: string | null;
  example_sentences?: string[];
  original_text?: string;
  // For exercise
  exercise_type?: string;
  question?: string;
  answer?: string;
  text_support?: string | null;
  content?: Record<string, unknown> | null;
};

/** True when the app already holds this item, so the user must choose keep / overwrite / merge. */
export function hasConflict(c: Candidate): boolean {
  if (!c.existing) return false;
  return c.kind === "calligraphy" || c.flags.some((f) => f.code.startsWith("already_in_"));
}

/** A live conflicting card with no choice yet: it is never sent. */
export function needsDecision(r: Row): boolean {
  return !r.deleted && r.on_conflict === null && hasConflict(r.candidate);
}

export type Filter = "all" | "verified" | "flagged" | "pending";

/** Verified candidates start checked; anything the verifier could not confirm is opt-in. */
export function initialRows(candidates: Candidate[]): Row[] {
  return candidates.map((candidate) => {
    const row: Row = {
      candidate,
      selected: candidate.status === "verified" && !hasConflict(candidate),
      on_conflict: hasConflict(candidate) ? null : "keep",
    };
    if (candidate.kind === "grammar") {
      row.title = candidate.title ?? "";
      row.explanation = candidate.explanation ?? "";
      row.example_sentences = candidate.example_sentences ?? [];
      row.original_text = candidate.original_text;
    } else if (candidate.kind === "calligraphy") {
      row.character = candidate.character ?? "";
      row.meaning = candidate.meaning ?? "";
      row.phonetic = candidate.phonetic ?? "";
      row.radical = candidate.radical ?? null;
      row.strokes = candidate.strokes ?? null;
    } else if (candidate.kind === "exercise") {
      row.exercise_type = candidate.exercise_type ?? "";
      row.question = candidate.question ?? "";
      row.answer = candidate.answer ?? "";
      row.text_support = candidate.text_support ?? null;
      row.content = candidate.content ?? null;
    } else {
      // vocabulary
      row.word = candidate.word ?? "";
      row.translation = candidate.translation ?? "";
      row.phonetic = candidate.phonetic ?? "";
      row.word_type = (WORD_TYPES as readonly string[]).includes(candidate.word_type ?? "") ? candidate.word_type ?? "" : "";
    }
    return row;
  });
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "all") return rows;
  if (filter === "pending") return rows.filter((r) => !r.selected && !r.deleted);
  return rows.filter((r) => r.candidate.status === filter);
}

export function countRows(rows: Row[]) {
  const live = rows.filter((r) => !r.deleted);
  const verified = live.filter((r) => r.candidate.status === "verified").length;
  return {
    total: live.length, verified, flagged: live.length - verified,
    selected: live.filter((r) => r.selected).length,
    undecided: live.filter(needsDecision).length, deleted: rows.length - live.length,
  };
}

export type RowKind = "vocabulary" | "grammar" | "calligraphy" | "exercise";
const KIND_ORDER: RowKind[] = ["vocabulary", "grammar", "calligraphy", "exercise"];

/** Rows grouped per element kind in a fixed order; kinds with no rows are left out. */
export function rowsByKind(rows: Row[]): [RowKind, Row[]][] {
  return KIND_ORDER.map((k): [RowKind, Row[]] => [k, rows.filter((r) => (r.candidate.kind ?? "vocabulary") === k)])
    .filter(([, rs]) => rs.length > 0);
}

/** Why a candidate is flagged (warning-severity messages only; info notes are shown separately). */
export function warningReasons(c: Candidate): string[] {
  return c.flags.filter((f) => f.severity === "warning").map((f) => f.message);
}

export function infoNotes(c: Candidate): string[] {
  return c.flags.filter((f) => f.severity === "info").map((f) => f.message);
}

export type AcceptItem = { word: string; translation?: string; phonetic?: string; word_type?: string; on_conflict: ConflictMode };
export type AcceptElement = { kind: string; fields: Record<string, unknown> };
export type AcceptPayload = { items: AcceptItem[]; elements?: AcceptElement[] };

export function toAcceptItems(rows: Row[]): AcceptPayload {
  const items: AcceptItem[] = [];
  const elements: AcceptElement[] = [];

  for (const r of rows) {
    if (!r.selected || r.deleted || needsDecision(r)) continue;

    if (r.candidate.kind === "grammar") {
      const title = (r.title ?? "").trim();
      const explanation = (r.explanation ?? "").trim();
      if (title && explanation) {
        elements.push({
          kind: "grammar",
          fields: {
            title,
            explanation,
            example_sentences: r.example_sentences ?? [],
          },
        });
      }
    } else if (r.candidate.kind === "calligraphy") {
      const character = (r.character ?? "").trim();
      if (character && character.length === 1) {
        elements.push({
          kind: "calligraphy",
          fields: {
            character,
            phonetic: (r.phonetic ?? "").trim() || null,
            meaning: (r.meaning ?? "").trim() || null,
            radical: (r.radical ?? "").trim() || null,
            strokes: r.strokes ? Number(r.strokes) : null,
            on_conflict: r.on_conflict ?? "keep",
          },
        });
      }
    } else if (r.candidate.kind === "exercise") {
      const question = (r.question ?? "").trim();
      const answer = (r.answer ?? "").trim();
      if (question && answer) {
        elements.push({
          kind: "exercise",
          fields: {
            exercise_type: r.exercise_type ?? "",
            question,
            answer,
            text_support: (r.text_support ?? "").trim() || null,
            content: r.content ?? null,
          },
        });
      }
    } else {
      // vocabulary
      const word = (r.word ?? "").trim();
      if (!word) continue;
      const item: AcceptItem = { word, on_conflict: r.on_conflict ?? "keep" };
      for (const key of ["translation", "phonetic", "word_type"] as const) {
        const value = (r[key] ?? "").trim();
        if (value) item[key] = value;
      }
      items.push(item);
    }
  }

  return { items, ...(elements.length > 0 && { elements }) };
}

/** First and last page (1-based) among the keys of a job's `page_kinds`; undefined when it has none. */
export function pageSpan(pageKinds: Record<string, unknown> | null | undefined): [number, number] | undefined {
  const pages = Object.keys(pageKinds ?? {}).map(Number).filter((n) => Number.isInteger(n));
  return pages.length ? [Math.min(...pages), Math.max(...pages)] : undefined;
}

/** A stored conversation's `question` JSON as readable "Speaker: text" lines (the raw string if it is not that JSON). */
export function dialogueLines(question: string): string[] {
  try {
    const d = JSON.parse(question) as { speakers: { id: string; name: string; isUser: boolean }[]; lines: { speakerId: string; text: string }[] };
    const name = (id: string) => d.speakers.find((s) => s.id === id);
    return d.lines.map((l) => `${name(l.speakerId)?.name ?? "?"}${name(l.speakerId)?.isUser ? " (you)" : ""}: ${l.text}`);
  } catch {
    return [question];
  }
}

/** Replace the ticked grammar rows by one pending row holding the merged text; the sources stay as deleted rows (undoable). */
export function mergeRows(rows: Row[], ids: string[], merged: { title: string; explanation: string; example_sentences: string[] }): Row[] {
  const picked = rows.filter((r) => ids.includes(r.candidate.id) && !r.deleted);
  if (picked.length < 2) return rows;
  const first = picked[0].candidate;
  const original_text = picked.map((r) => r.original_text).filter(Boolean).join("\n\n");
  const candidate: Candidate = {
    id: `merged_${picked.map((r) => r.candidate.id).join("+")}`, kind: "grammar", ...merged, original_text, quote: first.quote,
    page: Math.min(...picked.map((r) => r.candidate.page)), page_end: Math.max(...picked.map((r) => r.candidate.page_end ?? r.candidate.page)), chunk_id: first.chunk_id, status: "flagged", min_conf: null,
    flags: [{ code: "grammar_generated", message: "Joined by the model from the selected points - check it", severity: "warning" }],
  };
  const out: Row[] = [];
  for (const r of rows) {
    if (!picked.includes(r)) { out.push(r); continue; }
    if (out.every((o) => o.candidate.id !== candidate.id)) out.push({ candidate, selected: false, on_conflict: "keep", ...merged, original_text });
    out.push({ ...r, deleted: true, selected: false });
  }
  return out;
}

/** Replace the ticked exercise rows by one pending row holding the rebuilt exercise; the sources stay as deleted rows (undoable). */
export function mergeExerciseRows(rows: Row[], ids: string[], merged: Pick<Candidate, "exercise_type" | "question" | "answer" | "text_support" | "content" | "status" | "flags" | "quote">): Row[] {
  const picked = rows.filter((r) => ids.includes(r.candidate.id) && !r.deleted);
  if (picked.length < 2) return rows;
  const first = picked[0].candidate;
  const candidate: Candidate = {
    ...merged, id: `merged_${picked.map((r) => r.candidate.id).join("+")}`, kind: "exercise", chunk_id: first.chunk_id, min_conf: null,
    page: Math.min(...picked.map((r) => r.candidate.page)), page_end: Math.max(...picked.map((r) => r.candidate.page_end ?? r.candidate.page)),
  };
  const [row] = initialRows([candidate]);
  const out: Row[] = [];
  for (const r of rows) {
    if (!picked.includes(r)) { out.push(r); continue; }
    if (out.every((o) => o.candidate.id !== candidate.id)) out.push({ ...row, selected: false });
    out.push({ ...r, deleted: true, selected: false });
  }
  return out;
}
