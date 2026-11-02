"use client";

import { Fragment, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/dialogs/modal";
import { pageImageUrl } from "@/api/ingestion";
import {
  type AcceptPayload, type Candidate, type Filter, type Row, type RowKind, countRows, filterRows, infoNotes,
  dialogueLines, initialRows, rowsByKind, toAcceptItems, ttsClipCount, warningReasons, WORD_TYPES,
} from "@/lib/ingestion/review";
import PagePanel from "./pagePanel";
import MediaFields from "./mediaFields";
import ReviewCard from "./reviewCard";

const TAB_KEY: Record<RowKind, string> = { vocabulary: "vocabulary", grammar: "grammar", calligraphy: "calligraphy", exercise: "exercises" };
const MERGE_FIELDS: Partial<Record<RowKind, string[]>> = {
  vocabulary: ["translation", "phonetic", "word_type"], calligraphy: ["meaning", "phonetic", "radical", "strokes"],
};
const clip = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n)}…` : t);

// The candidate list shared by lesson-level and language-level imports: one tab per kind, each item a compact card
// the user confirms, edits or deletes. Only confirmed items are added; verified ones start confirmed.
export default function ReviewPanel({ jobId, filename, candidates, addLabel, onAdd, range, pages, canGenerateAudio = false }: {
  jobId: string;
  filename: string;
  candidates: Candidate[];
  addLabel: (selected: number) => string;
  onAdd: (payload: AcceptPayload) => Promise<void>;
  range?: [number, number];
  pages?: number[];   // the lesson's own pages when it is made of separate ranges
  canGenerateAudio?: boolean; // the user has a text-to-speech endpoint
}) {
  const t = useTranslations("ingestion");
  const [rows, setRows] = useState<Row[]>(() => initialRows(candidates));
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<RowKind | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tts, setTts] = useState(false);
  const [focusedPage, setFocusedPage] = useState<number>(candidates[0] ? candidates[0].page + 1 : range?.[0] ?? 1);

  const counts = useMemo(() => countRows(rows), [rows]);
  const clips = useMemo(() => ttsClipCount(rows), [rows]);
  const groups = useMemo(() => rowsByKind(rows), [rows]);
  const active = groups.find(([k]) => k === tab)?.[0] ?? groups[0]?.[0];
  const activeRows = groups.find(([k]) => k === active)?.[1] ?? [];
  const visible = filterRows(activeRows, filter);
  const patch = (id: string, change: Partial<Row>) => setRows((rs) => rs.map((r) => (r.candidate.id === id ? { ...r, ...change } : r)));
  const confirmVerified = () => setRows((rs) => rs.map((r) =>
    ((r.candidate.kind ?? "vocabulary") === active && r.candidate.status === "verified" && !r.deleted ? { ...r, selected: true } : r)));

  const setActive = (change: Partial<Row>) => setRows((rs) => rs.map((r) => ((r.candidate.kind ?? "vocabulary") === active && !r.deleted ? { ...r, ...change } : r)));

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = toAcceptItems(rows, tts && canGenerateAudio);
      const sent = payload.items.length + (payload.elements?.length ?? 0);
      if (sent < counts.selected) {   // a confirmed card with a required field emptied is never dropped silently
        setError(t("incompleteConfirmed", { count: counts.selected - sent }));
        setSaving(false);
        return;
      }
      await onAdd(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("couldNotAddItems"));
      setSaving(false);
    }
  };

  const pageSpan: [number, number] = range ?? [1, Math.max(1, ...candidates.map((c) => c.page + 1))];

  const renderRow = (row: Row) => {
    const c = row.candidate;
    const kind = c.kind ?? "vocabulary";
    const reasons = warningReasons(c);
    const info = infoNotes(c);
    const has = (code: string) => c.flags.some((f) => f.code === code);
    const confirmedTitle = c.status === "verified" ? t("foundInText") : t("notConfirmed");
    const footer = (
      <>
        {reasons.length > 0 && <ul className="list-disc pl-5 text-sm">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        {info.length > 0 && <p className="text-sm opacity-70">ℹ {info.join(" ")}</p>}
        <p className="text-sm opacity-70">{t("pageQuote", { page: c.page + 1, quote: c.quote })} <button type="button" className="link underline" onClick={() => setPreview(c.page + 1)}>{t("viewPage")}</button></p>
      </>
    );
    const common = {
      row, footer, onPatch: (change: Partial<Row>) => patch(c.id, change),
      media: <MediaFields row={row} jobId={jobId} ttsAvailable={canGenerateAudio} onPatch={(change) => patch(c.id, change)} />,
      onFocus: () => setFocusedPage(c.page + 1), mergeFields: MERGE_FIELDS[kind],
    };

    if (kind === "grammar") {
      const generated = has("grammar_generated");
      return (
        <ReviewCard {...common} summary={<><strong>{row.title}</strong> <span className="opacity-70">{clip(row.explanation ?? "")}</span></>}
          badge={generated ? t("generatedBadge") : c.status === "verified" ? t("verifiedBadge") : t("checkBadge")}
          badgeTitle={generated ? t("generatedBadgeTitle") : confirmedTitle}>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("title")}</span>
            <input className="input" value={row.title || ""} onChange={(e) => patch(c.id, { title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("explanation")}</span>
            <textarea className="input input-grow min-h-40" value={row.explanation || ""} onChange={(e) => patch(c.id, { explanation: e.target.value })} />
          </label>
          {row.original_text && (
            <details className="text-sm">
              <summary className="cursor-pointer">{t("originalPageText")}</summary>
              <p className="mt-2 whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs opacity-70 dark:bg-gray-900">{row.original_text}</p>
            </details>
          )}
        </ReviewCard>
      );
    }
    if (kind === "calligraphy") {
      return (
        <ReviewCard {...common} existing={c.existing} summary={<><span className="mr-2 text-2xl">{row.character}</span>{row.meaning}</>}
          badge={c.status === "verified" ? t("verifiedBadge") : t("checkBadge")} badgeTitle={confirmedTitle}>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-16 flex-col gap-1">
              <span className="field-label">{t("character")}</span>
              <input className="input text-center text-2xl" value={row.character || ""} onChange={(e) => patch(c.id, { character: e.target.value })} maxLength={1} />
            </label>
            {(["phonetic", "meaning", "radical"] as const).map((key) => (
              <label key={key} className="flex min-w-24 flex-1 flex-col gap-1">
                <span className="field-label">{t(`field_${key}`)}</span>
                <input className="input" value={row[key] || ""} onChange={(e) => patch(c.id, { [key]: e.target.value })} />
              </label>
            ))}
            <label className="flex min-w-20 flex-col gap-1">
              <span className="field-label">{t("strokes")}</span>
              <input className="input" type="number" value={row.strokes ?? ""} onChange={(e) => patch(c.id, { strokes: e.target.value || null })} />
            </label>
          </div>
        </ReviewCard>
      );
    }
    if (kind === "exercise") {
      const generated = has("answer_generated");
      return (
        <ReviewCard {...common} summary={row.exercise_type === "conversation"
          ? <><span className="badge mr-2">{t("conversation")}</span><span className="block whitespace-pre-line">{dialogueLines(row.question ?? "").join("\n")}</span></>
          : <><span className="badge mr-2">{row.exercise_type || t("exerciseFallback")}</span>{clip(row.question ?? "")}</>}
          badge={generated ? t("generatedAnswer") : c.status === "verified" ? t("verifiedBadge") : t("checkBadge")}
          badgeTitle={generated ? t("generatedAnswerTitle") : confirmedTitle}>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("question")}</span>
            <textarea className="input input-grow" value={row.question || ""} onChange={(e) => patch(c.id, { question: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("answer")}</span>
            <textarea className="input input-grow" value={row.answer || ""} onChange={(e) => patch(c.id, { answer: e.target.value })} />
          </label>
          {row.content && <p className="text-sm opacity-70"><strong>{t("contentColon")}</strong> <code className="text-xs">{JSON.stringify(row.content)}</code></p>}
        </ReviewCard>
      );
    }
    const generated = has("translation_generated");
    const exists = c.flags.some((f) => f.code.startsWith("already_in_")) && c.existing ? c.existing : null;
    return (
      <ReviewCard {...common} existing={exists}
        summary={<><strong>{row.word}</strong> {row.phonetic && <span className="opacity-70">{row.phonetic} </span>}— {row.translation}{row.word_type && <span className="opacity-60"> ({row.word_type})</span>}</>}
        badge={generated ? t("generatedTranslation") : c.status === "verified" ? t("verifiedBadge") : t("checkBadge")}
        badgeTitle={generated ? t("generatedTranslationTitle") : confirmedTitle}>
        <div className="flex flex-wrap gap-3">
          {(["word", "translation", "phonetic"] as const).map((key) => (
            <label key={key} className="flex min-w-32 flex-1 flex-col gap-1">
              <span className="field-label">{t(`field_${key}`)}</span>
              <input className="input" value={row[key] || ""} onChange={(e) => patch(c.id, { [key]: e.target.value })} />
            </label>
          ))}
          <label className="flex min-w-32 flex-col gap-1">
            <span className="field-label">{t("field_type")}</span>
            <select className="input" value={row.word_type || ""} onChange={(e) => patch(c.id, { word_type: e.target.value })}>
              {WORD_TYPES.map((w) => <option key={w} value={w}>{w || "—"}</option>)}
            </select>
          </label>
        </div>
      </ReviewCard>
    );
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p aria-live="polite">
            {t("foundStatistics", { total: counts.total, verified: counts.verified, flagged: counts.flagged, selected: counts.selected })}
          </p>
          <p className="text-xs opacity-60">
            {t("reviewExplanation")}
          </p>
        </div>

        {groups.length > 0 && (
          <div role="tablist" aria-label={t("kindsOfElement")} className="flex flex-wrap gap-x-5 border-b border-gray-300 dark:border-gray-700">
            {groups.map(([k, rs]) => (
              <button key={k} type="button" role="tab" aria-selected={k === active} className="review-tab min-h-11" data-active={k === active}
                onClick={() => setTab(k)}>
                {t(TAB_KEY[k])} {rs.filter((r) => !r.deleted).length}
              </button>
            ))}
          </div>
        )}

        {counts.total === 0 && groups.length === 0 && <p className="card">{t("nothingFound")}</p>}

        {groups.length > 0 && (
          <div className="btn-row flex-wrap">
            {(["all", "verified", "flagged"] as Filter[]).map((f) => (
              <button key={f} type="button" className={`btn ${filter === f ? "btn-primary" : "btn-secondary"}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? t("filterAll") : f === "verified" ? t("filterVerified") : t("filterFlagged")}
              </button>
            ))}
            <button type="button" className="btn btn-secondary" onClick={confirmVerified}>{t("confirmAllVerified")}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setActive({ selected: true })}>{t("confirmAll")}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setActive({ deleted: true, selected: false })}>{t("rejectAll")}</button>
          </div>
        )}

        <ul className="m-0 flex list-none flex-col gap-2 p-0" role="tabpanel">{visible.map((r) => <Fragment key={r.candidate.id}>{renderRow(r)}</Fragment>)}</ul>

        {clips > 0 && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={tts && canGenerateAudio} disabled={!canGenerateAudio} onChange={(e) => setTts(e.target.checked)} />
            <span>
              {t("audioClips", { count: clips })}
              {!canGenerateAudio && <span className="block opacity-70">{t("audioClipsDisabled")}</span>}
            </span>
          </label>
        )}
        {error && <p role="alert" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
        <div className="btn-row flex-wrap">
          <button type="button" className="btn btn-primary" disabled={saving || counts.selected === 0} onClick={add}>
            {saving ? t("addingButton") : addLabel(counts.selected)}
          </button>
        </div>
      </div>

      <PagePanel jobId={jobId} page={focusedPage} range={pageSpan} pages={pages} onPage={setFocusedPage} />

      {preview !== null && (
        <Modal title={t("imageViewerTitle", { page: preview, filename })} onClose={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pageImageUrl(jobId, preview)} alt={t("originalPageAltLong", { page: preview })} className="mx-auto max-h-[70vh]" />
        </Modal>
      )}
    </div>
  );
}
