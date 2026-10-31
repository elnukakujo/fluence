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
  chunk_id: string;
  status: "verified" | "flagged";
  flags: Flag[];
  min_conf: number | null;
  // For non-vocabulary elements
  kind?: "grammar" | "passage" | "character";
  title?: string;
  explanation?: string;
  character?: string;
  text?: string;
  meaning?: string;
  radical?: string | null;
  strokes?: string | null;
  example_sentences?: string[];
};

export type ConflictMode = "keep" | "merge" | "overwrite";

export type Row = {
  candidate: Candidate;
  selected: boolean;
  // editable copies, so the user can fix a word without losing what the model said
  word?: string;
  translation?: string;
  phonetic?: string;
  word_type?: string;
  on_conflict: ConflictMode;
  // For non-vocabulary elements
  title?: string;
  explanation?: string;
  character?: string;
  text?: string;
  meaning?: string;
  radical?: string | null;
  strokes?: string | null;
};

export type Filter = "all" | "verified" | "flagged";

/** Verified candidates start checked; anything the verifier could not confirm is opt-in. */
export function initialRows(candidates: Candidate[]): Row[] {
  return candidates.map((candidate) => {
    const row: Row = {
      candidate,
      selected: candidate.status === "verified",
      on_conflict: "keep",
    };
    if (candidate.kind === "grammar") {
      row.title = candidate.title ?? "";
      row.explanation = candidate.explanation ?? "";
    } else if (candidate.kind === "passage") {
      row.text = candidate.text ?? "";
      row.translation = candidate.translation ?? "";
    } else if (candidate.kind === "character") {
      row.character = candidate.character ?? "";
      row.meaning = candidate.meaning ?? "";
      row.radical = candidate.radical ?? null;
      row.strokes = candidate.strokes ?? null;
    } else {
      // vocabulary
      row.word = candidate.word ?? "";
      row.translation = candidate.translation ?? "";
      row.phonetic = candidate.phonetic ?? "";
      row.word_type = candidate.word_type ?? "";
    }
    return row;
  });
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  return filter === "all" ? rows : rows.filter((r) => r.candidate.status === filter);
}

export function countRows(rows: Row[]) {
  const verified = rows.filter((r) => r.candidate.status === "verified").length;
  return { total: rows.length, verified, flagged: rows.length - verified, selected: rows.filter((r) => r.selected).length };
}

/** Why a candidate is flagged (warning-severity messages only; info notes are shown separately). */
export function warningReasons(c: Candidate): string[] {
  return c.flags.filter((f) => f.severity === "warning").map((f) => f.message);
}

export function infoNotes(c: Candidate): string[] {
  return c.flags.filter((f) => f.severity === "info").map((f) => f.message);
}

export type AcceptItem = { word: string; translation?: string; phonetic?: string; word_type?: string; on_conflict: ConflictMode };
export type AcceptPayload = { items: AcceptItem[]; elements?: { kind: string; fields: Record<string, unknown> }[] };

export function toAcceptItems(rows: Row[]): AcceptPayload {
  const items: AcceptItem[] = [];
  const elements: { kind: string; fields: Record<string, unknown> }[] = [];

  for (const r of rows) {
    if (!r.selected) continue;

    if (r.candidate.kind === "grammar") {
      const title = (r.title ?? "").trim();
      const explanation = (r.explanation ?? "").trim();
      if (title && explanation) {
        elements.push({
          kind: "grammar",
          fields: {
            title,
            explanation,
            example_sentences: r.candidate.example_sentences ?? [],
          },
        });
      }
    } else if (r.candidate.kind === "passage") {
      const text = (r.text ?? "").trim();
      if (text) {
        elements.push({
          kind: "passage",
          fields: {
            text,
            translation: (r.translation ?? "").trim() || null,
          },
        });
      }
    } else if (r.candidate.kind === "character") {
      const character = (r.character ?? "").trim();
      if (character) {
        elements.push({
          kind: "character",
          fields: {
            character,
            meaning: (r.meaning ?? "").trim() || null,
            radical: (r.radical ?? "").trim() || null,
            strokes: r.strokes ? Number(r.strokes) : null,
          },
        });
      }
    } else {
      // vocabulary
      const word = (r.word ?? "").trim();
      if (!word) continue;
      const item: AcceptItem = { word, on_conflict: r.on_conflict };
      for (const key of ["translation", "phonetic", "word_type"] as const) {
        const value = (r[key] ?? "").trim();
        if (value) item[key] = value;
      }
      items.push(item);
    }
  }

  return { items, ...(elements.length > 0 && { elements }) };
}

export type PageRangeResult = { ok: true; range: [number, number] | null } | { ok: false; error: string };

/** Mirrors the server's validation: both bounds or neither, whole numbers, 1-based, last >= first. */
export function parsePageRange(first: string, last: string): PageRangeResult {
  const a = first.trim(), b = last.trim();
  if (!a && !b) return { ok: true, range: null };
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return { ok: false, error: "Give both the first and the last page as whole numbers" };
  const from = Number(a), to = Number(b);
  if (from < 1 || to < from) return { ok: false, error: "The range must start at page 1 or later and end on or after its first page" };
  return { ok: true, range: [from, to] };
}
