"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Row } from "@/lib/ingestion/review";
import {
  BlankContentEditor, DictationContentEditor, MatchingContentEditor, OrganizeContentEditor, QuizzContentEditor, ReadingContentEditor,
} from "@/components/exercises/contentEditors";
import TrueFalseInput from "@/components/exercises/trueFalseInput";
import { dictationRows, readingRows } from "@/components/exercises/readingDictationRows";
import {
  blankContent, blankRows, blankStart, dictationFromRows, editedFields, instructionOf, organizeInOrder, readingFromRows, withInstruction,
} from "@/lib/ingestion/exerciseEdit";

type Content = Record<string, unknown>;
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const DERIVED = ["type_in_the_blank", "select_in_the_blank", "organize", "true_false"];

/** Edit mode of an imported exercise: the same per-type editors as the exercise form, so the stored question/answer/content stay consistent. */
export default function ExerciseEditor({ row, onChange }: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  const t = useTranslations("ingestion");
  const tEx = useTranslations("exercises");
  const type = row.exercise_type ?? "";
  const c = (row.content ?? null) as Content | null;

  const start = c ? null : blankStart(row.question ?? "", row.answer ?? "");
  const [segments, setSegments] = useState<string[]>(() => (list<string>(c?.segments).length ? list<string>(c?.segments) : start?.segments ?? ["", ""]));
  const [blanks, setBlanks] = useState(() => (c ? blankRows(c) : start!.rows));
  const [pairs, setPairs] = useState<[string, string][]>(() => (list<[string, string]>(c?.pairs).length ? list<[string, string]>(c?.pairs) : [["", ""]]));
  const [items, setItems] = useState<string[]>(() => organizeInOrder(c));
  const [statement, setStatement] = useState(() => String(c?.statement ?? instructionLess(row.question)));
  const [truth, setTruth] = useState(c?.answer !== false);
  const [options, setOptions] = useState<string[]>(() => (list<string>(c?.options).length ? list<string>(c?.options) : ["", ""]));
  const [correct, setCorrect] = useState<number[]>(() => list<number>(c?.correct));
  const [reading, setReading] = useState(() => readingRows(c as Parameters<typeof readingRows>[0]));
  const [dictation, setDictation] = useState(() => dictationRows(c as Parameters<typeof dictationRows>[0]));

  const content: Content | null =
    type === "type_in_the_blank" || type === "select_in_the_blank" ? blankContent(segments, blanks)
    : type === "matching" ? { pairs }
    : type === "organize" ? { items, answer_order: items.map((_, i) => i) }
    : type === "true_false" ? { statement, answer: truth }
    : type === "quizz" ? { options, correct }
    : type === "reading" ? readingFromRows(reading)
    : type === "dictation" ? dictationFromRows(dictation)
    : null;

  // push every edit up, but not the initial render: opening Edit must not change the card
  const latest = useRef(row); latest.current = row;
  const first = useRef(true);
  const key = JSON.stringify(content);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!content) return;
    const r = latest.current;
    onChange(editedFields(type, r.question ?? "", (r.content ?? null) as Content | null, content));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const field = (label: string, value: string, set: (v: string) => void, area = true) => (
    <label className="flex flex-col gap-1">
      <span className="field-label">{label}</span>
      {area ? <textarea className="input input-grow" value={value} onChange={(e) => set(e.target.value)} />
        : <input className="input" value={value} onChange={(e) => set(e.target.value)} />}
    </label>
  );
  const support = field(t("supportText"), row.text_support ?? "", (v) => onChange({ text_support: v || null }));
  const derived = DERIVED.includes(type);
  const instruction = field(t("instruction"), instructionOf(type, row.question ?? "", c), (v) =>
    onChange({ question: derived && content ? withInstruction(type, content, v) : v }), false);

  return (
    <div className="flex flex-col gap-2">
      {derived || ["matching", "reading", "dictation"].includes(type) ? instruction : field(t("question"), row.question ?? "", (v) => onChange({ question: v }))}
      {support}
      {(type === "type_in_the_blank" || type === "select_in_the_blank") && (
        <BlankContentEditor hasOptions={type === "select_in_the_blank"} segments={segments} setSegments={setSegments} blanks={blanks} setBlanks={setBlanks} />
      )}
      {type === "matching" && <MatchingContentEditor pairs={pairs} setPairs={setPairs} />}
      {type === "organize" && <OrganizeContentEditor items={items} setItems={setItems} />}
      {type === "quizz" && <QuizzContentEditor options={options} setOptions={setOptions} correct={correct} setCorrect={setCorrect} />}
      {type === "true_false" && <>
        {field(tEx("statement"), statement, setStatement)}
        <TrueFalseInput value={truth} onChange={(e) => setTruth(e.target.value === "true")} label={tEx("answer")} />
      </>}
      {type === "reading" && <ReadingContentEditor rows={reading} setRows={setReading} />}
      {type === "dictation" && <DictationContentEditor rows={dictation} setRows={setDictation} />}
      {!content && field(t("answer"), row.answer ?? "", (v) => onChange({ answer: v }))}
    </div>
  );
}

const instructionLess = (q?: string) => (q ?? "").slice((q ?? "").lastIndexOf("\n") + 1);
