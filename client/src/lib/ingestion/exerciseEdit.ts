import { dictationContent, readingContent, type DictationRow, type ReadingRow } from "@/components/exercises/readingDictationRows";
import type { BlankRow } from "@/components/exercises/contentEditors";

type Content = Record<string, unknown>;
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Types whose question the exercise form derives from the content (the consigne line, if any, stays in front of it). */
const DERIVED: Record<string, (c: Content) => string> = {
  type_in_the_blank: (c) => list<string>(c.segments).join("__"),
  select_in_the_blank: (c) => list<string>(c.segments).join("__"),
  organize: (c) => list<string>(c.items).join(" "),
  true_false: (c) => String(c.statement ?? ""),
};

/** Everything before the derived text: the model's consigne line. Without old content, everything up to the last line break. */
function lead(question: string, old: Content | null, type: string): string {
  const oldText = old ? DERIVED[type](old) : "";
  if (oldText && question.endsWith(oldText)) return question.slice(0, question.length - oldText.length);
  return question.includes("\n") ? question.slice(0, question.lastIndexOf("\n") + 1) : "";
}

/** question/answer/content after the user edited `content` of a `type` exercise, stored the way the exercise form stores them. */
export function editedFields(type: string, question: string, old: Content | null, content: Content): { question: string; answer: string; content: Content } {
  const c = content;
  if (type === "type_in_the_blank" || type === "select_in_the_blank") {
    return { question: lead(question, old, type) + DERIVED[type](c), answer: list<{ answer: string }>(c.blanks).map((b) => b.answer).join(", "), content };
  }
  if (type === "organize") return { question: lead(question, old, type) + DERIVED[type](c), answer: list<string>(c.items).join(" "), content };
  if (type === "true_false") return { question: lead(question, old, type) + DERIVED[type](c), answer: String(c.answer), content };
  if (type === "matching") return { question, answer: list<[string, string]>(c.pairs).map((p) => p.join(" - ")).join("; "), content };
  if (type === "quizz") {
    const options = list<string>(c.options);
    return { question, answer: list<number>(c.correct).map((i) => options[i]).join(", "), content };
  }
  const lines = list<{ text: string }>(c.lines).map((l) => l.text);
  const first = question.trim() ? question : (lines[0] ?? "").slice(0, 60);
  return { question: first, answer: lines.join(type === "reading" ? "\n" : " "), content };
}

export const blankRows = (c: Content | null): BlankRow[] =>
  list<{ answer: string; options?: string[] }>(c?.blanks).length
    ? list<{ answer: string; options?: string[] }>(c?.blanks).map((b) => ({ answer: b.answer, options: (b.options ?? []).join(", ") }))
    : [{ answer: "", options: "" }];

export const blankContent = (segments: string[], rows: BlankRow[]): Content => ({
  segments,
  blanks: rows.map((b) => ({ answer: b.answer, ...(b.options.trim() ? { options: b.options.split(",").map((o) => o.trim()).filter(Boolean) } : {}) })),
});

/** The organize items listed in their correct order (the form edits them that way and stores the identity order). */
export function organizeInOrder(c: Content | null): string[] {
  const items = list<string>(c?.items), order = list<number>(c?.answer_order);
  return order.length === items.length && items.length ? order.map((i) => items[i]) : items.length ? items : ["", ""];
}

export const readingFromRows = (rows: ReadingRow[]): Content => readingContent(rows);
export const dictationFromRows = (rows: DictationRow[]): Content => dictationContent(rows);

/** A light client check that edited content is usable; the server re-validates on accept. */
export function contentIsValid(type: string, content: Content | null): boolean {
  if (!content) return false;
  if (type === "type_in_the_blank" || type === "select_in_the_blank") {
    const blanks = list<{ answer: string; options?: string[] }>(content.blanks);
    return blanks.length > 0 && list(content.segments).length === blanks.length + 1 && blanks.every((b) => b.answer.trim() !== "")
      && (type === "type_in_the_blank" || blanks.every((b) => (b.options?.length ?? 0) >= 2 && b.options!.includes(b.answer)));
  }
  return true;
}

/** The consigne/instruction the user edits: the line(s) before the derived text for derived types, else the whole question. */
export function instructionOf(type: string, question: string, content: Content | null): string {
  return type in DERIVED ? lead(question, content, type).replace(/\n$/, "") : question;
}

/** The question after the user changed the instruction of a derived type (the derived text stays behind it). */
export function withInstruction(type: string, content: Content, instruction: string): string {
  return (instruction.trim() ? `${instruction.trim()}\n` : "") + DERIVED[type](content);
}

/** Blank exercises that lost their content: rebuild the editor's starting point from the question (holes are runs of `_`) and the answer. */
export function blankStart(question: string, answer: string): { segments: string[]; rows: BlankRow[] } {
  const item = question.includes("\n") ? question.slice(question.lastIndexOf("\n") + 1) : question;
  const segments = item.split(/_{2,}/);
  if (segments.length < 2) return { segments: ["", ""], rows: [{ answer: "", options: "" }] };
  const answers = answer.split(/\s*(?:,|__)\s*/);
  return { segments, rows: segments.slice(1).map((_, i) => ({ answer: answers[i] ?? "", options: "" })) };
}
