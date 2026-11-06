"use client";

import { useTranslations } from "next-intl";
import { ArrowLeftRight, Check } from "lucide-react";
import { dialogueLines, type Row } from "@/lib/ingestion/review";

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const FREE_TEXT = ["essay", "answering", "translate", "speaking"];

/** Every field of an imported exercise, laid out the way its type uses it: instruction, support text, the type's own content, answer. */
export default function ExerciseBody({ row }: { row: Row }) {
  const t = useTranslations("ingestion");
  const type = row.exercise_type ?? "";
  const content = (row.content ?? {}) as Record<string, unknown>;
  const support = row.text_support?.trim();

  const body = () => {
    if (type === "quizz") {
      const options = list<string>(content.options), correct = list<number>(content.correct);
      return (
        <ul className="flex flex-col gap-1" aria-label={t("exOptions")}>
          {options.map((o, i) => (
            <li key={i} className={`flex items-center gap-2 rounded px-2 py-1 ${correct.includes(i) ? "bg-accent-soft font-medium" : ""}`}>
              {correct.includes(i) ? <Check size={16} aria-hidden /> : <span className="w-4" aria-hidden />}
              <span>{o}</span>{correct.includes(i) && <span className="sr-only">{t("exCorrect")}</span>}
            </li>
          ))}
        </ul>
      );
    }
    if (type === "true_false") {
      return <p><span className="field-label">{t("answer")}</span> <span className="badge">{content.answer === true ? t("exTrue") : t("exFalse")}</span></p>;
    }
    if (type === "organize") {
      const items = list<string>(content.items), order = list<number>(content.answer_order);
      return (
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap gap-1" aria-label={t("exPieces")}>{items.map((w, i) => <span key={i} className="badge">{w}</span>)}</p>
          <p><span className="field-label">{t("exOrder")}</span> {order.map((i) => items[i]).join(" ")}</p>
        </div>
      );
    }
    if (type === "type_in_the_blank" || type === "select_in_the_blank") {
      const segments = list<string>(content.segments), blanks = list<{ answer: string; options?: string[] }>(content.blanks);
      return (
        <p className="leading-8">
          {segments.map((s, i) => (
            <span key={i}>{s}{blanks[i] && (
              <mark className="rounded bg-accent-soft px-1 font-medium">{blanks[i].answer}
                {blanks[i].options && <span className="ml-1 text-xs font-normal opacity-70">({blanks[i].options!.join(" / ")})</span>}</mark>
            )}</span>
          ))}
        </p>
      );
    }
    if (type === "matching") {
      return (
        <ul className="flex flex-col gap-1" aria-label={t("exPairs")}>
          {list<[string, string]>(content.pairs).map(([a, b], i) => (
            <li key={i} className="flex items-center gap-2"><span>{a}</span><ArrowLeftRight size={14} aria-hidden className="opacity-60" /><span>{b}</span></li>
          ))}
        </ul>
      );
    }
    if (type === "reading" || type === "dictation") {
      const names = Object.fromEntries(list<{ id: string; name: string }>(content.speakers).map((s) => [s.id, s.name]));
      return (
        <ol className="flex flex-col gap-1">
          {list<{ speakerId?: string; text: string; translation?: string | null }>(content.lines).map((l, i) => (
            <li key={i}>{l.speakerId && <strong>{names[l.speakerId]}: </strong>}{l.text}{l.translation && <span className="block text-sm opacity-70">{l.translation}</span>}</li>
          ))}
        </ol>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-3">
      {row.question && (
        <div>
          <p className="field-label">{type === "conversation" ? t("conversation") : t("question")}</p>
          <p className="whitespace-pre-line font-medium">{type === "conversation" ? dialogueLines(row.question).join("\n") : row.question}</p>
        </div>
      )}
      {support && (
        <details open={support.length <= 240} className="rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
          <summary className="field-label cursor-pointer">{t("supportText")}</summary>
          <p className="mt-1 whitespace-pre-wrap">{support}</p>
        </details>
      )}
      {body()}
      {FREE_TEXT.includes(type) && row.answer && (
        <div><p className="field-label">{t("answer")}</p><p className="whitespace-pre-line">{row.answer}</p></div>
      )}
    </div>
  );
}
