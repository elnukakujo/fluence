// Pure helpers for the import review screen (no React, unit-tested).

export type ImageCrop = { page: number; bbox: [number, number, number, number]; page_size: [number, number]; has_picture: boolean };

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
  existing?: Record<string, string | number | null> | null; // what the app already holds for this item
  image_crop?: ImageCrop | null; // a picture found beside the item on its page
  audio_lines?: string[]; // what would be spoken, one clip per line
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
  "particle", "interjection", "numeral", "classifier", "auxiliary", "modal"] as const;

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
  on_conflict: ConflictMode;
  // support media: the detected crop is used unless switched off; an upload replaces it; audio clips can be replaced per line
  useCrop?: boolean;
  imageUpload?: { id: string; name: string };
  audioUploads?: Record<number, { id: string; name: string }>;
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

export type Filter = "all" | "verified" | "flagged";

/** Verified candidates start checked; anything the verifier could not confirm is opt-in. */
export function initialRows(candidates: Candidate[]): Row[] {
  return candidates.map((candidate) => {
    const row: Row = {
      candidate,
      selected: candidate.status === "verified",
      on_conflict: "keep",
      useCrop: !!candidate.image_crop,
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
  return filter === "all" ? rows : rows.filter((r) => r.candidate.status === filter);
}

export function countRows(rows: Row[]) {
  const live = rows.filter((r) => !r.deleted);
  const verified = live.filter((r) => r.candidate.status === "verified").length;
  return {
    total: live.length, verified, flagged: live.length - verified,
    selected: live.filter((r) => r.selected).length, deleted: rows.length - live.length,
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

export type Media = {
  image?: { crop: ImageCrop } | { upload: string };
  audio?: { lines: string[]; uploads: Record<number, string>; tts: boolean };
};
export type AcceptItem = { word: string; translation?: string; phonetic?: string; word_type?: string; on_conflict: ConflictMode; media?: Media };
export type AcceptElement = { kind: string; fields: Record<string, unknown>; media?: Media };
export type AcceptPayload = { items: AcceptItem[]; elements?: AcceptElement[] };

/** The media the user chose for a row: their upload, else the detected picture if still on; audio per line. */
export function mediaFor(r: Row, tts: boolean): Media | undefined {
  const media: Media = {};
  if (r.imageUpload) media.image = { upload: r.imageUpload.id };
  else if (r.useCrop && r.candidate.image_crop) media.image = { crop: r.candidate.image_crop };
  const lines = r.candidate.audio_lines ?? [];
  if (lines.length > 0) {
    media.audio = { lines, uploads: Object.fromEntries(Object.entries(r.audioUploads ?? {}).map(([i, u]) => [i, u.id])) as unknown as Record<number, string>, tts };
  }
  return media.image || media.audio ? media : undefined;
}

/** How many clips TTS would make for the confirmed rows (lines the user did not replace with an upload). */
export function ttsClipCount(rows: Row[]): number {
  return rows.filter((r) => r.selected && !r.deleted)
    .reduce((n, r) => n + (r.candidate.audio_lines ?? []).filter((_, i) => !r.audioUploads?.[i]).length, 0);
}

export function toAcceptItems(rows: Row[], tts = false): AcceptPayload {
  const items: AcceptItem[] = [];
  const elements: AcceptElement[] = [];

  for (const r of rows) {
    if (!r.selected || r.deleted) continue;
    const nItems = items.length, nElements = elements.length;

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
            on_conflict: r.on_conflict,
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
      const item: AcceptItem = { word, on_conflict: r.on_conflict };
      for (const key of ["translation", "phonetic", "word_type"] as const) {
        const value = (r[key] ?? "").trim();
        if (value) item[key] = value;
      }
      items.push(item);
    }
    const media = mediaFor(r, tts);
    if (media) {
      if (items.length > nItems) items[nItems].media = media;
      if (elements.length > nElements) elements[nElements].media = media;
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
