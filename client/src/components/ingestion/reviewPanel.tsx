"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Ban, Check, Combine, Library as KeepIcon, ListFilter, PenLine } from "lucide-react";
import Modal from "@/components/ui/dialogs/modal";
import ItemActionBar from "@/components/elements/itemActionBar";
import { SelectAllRow, SelectionScope, SelectToggle, useItemSelection, type BarProps, type Kind } from "@/components/elements/itemSelection";
import Tick from "@/components/elements/tick";
import { mergeExercises, mergeGrammar, pageImageUrl, regenerateExercise, regenerateGrammar, type ExerciseItem } from "@/api/ingestion";
import { contentIsValid } from "@/lib/ingestion/exerciseEdit";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import ExerciseBody from "./exerciseBody";
import ExerciseEditor from "./exerciseEditor";
import RegenerateForm from "./regenerateForm";
import {
  type AcceptPayload, type Candidate, type Filter, type Row, type RowKind, countRows, filterRows, hasConflict, infoNotes, mergeExerciseRows, mergeRows, needsDecision,
  initialRows, rowsByKind, toAcceptItems, warningReasons, WORD_TYPES,
} from "@/lib/ingestion/review";
import PagePanel from "./pagePanel";
import ReviewCard from "./reviewCard";

const TAB_KEY: Record<RowKind, string> = { vocabulary: "vocabulary", grammar: "grammar", calligraphy: "calligraphy", exercise: "exercises" };
const MERGE_FIELDS: Partial<Record<RowKind, string[]>> = {
  vocabulary: ["translation", "phonetic", "word_type", "word_gender"], calligraphy: ["meaning", "phonetic", "radical", "strokes"],
};
const SELECT_KIND: Record<RowKind, Kind> = { vocabulary: "voc", grammar: "gram", calligraphy: "call", exercise: "ex" };
const rowLabel = (r: Row) => r.title || r.word || r.character || r.question?.slice(0, 40) || r.candidate.quote;

// Select-mode checkbox at the top of a card (the shared selection scope holds the ticks).
function RowTick({ kind, row }: { kind: Kind; row: Row }) {
  const t = useTranslations("ingestion");
  const { isActive, selected, toggle } = useItemSelection();
  if (!isActive(kind) || row.deleted) return null;
  const id = row.candidate.id;
  return (
    <label className="pick-row" data-selected={selected.has(id)}>
      <input type="checkbox" className="tick-input" aria-label={t("selectOne", { label: rowLabel(row) })} checked={selected.has(id)} onChange={() => toggle(id, rowLabel(row))} />
      <Tick />
    </label>
  );
}

// The candidate list shared by lesson-level and language-level imports: one tab per kind, each item a compact card
// the user confirms, edits or deletes. Only confirmed items are added; verified ones start confirmed.
export default function ReviewPanel({ jobId, filename, candidates, addLabel, onAdd, range, pages, onCounts }: {
  jobId: string;
  filename: string;
  candidates: Candidate[];
  addLabel: (selected: number) => string;
  onAdd: (payload: AcceptPayload) => Promise<void>;
  range?: [number, number];
  pages?: number[];   // the lesson's own pages when it is made of separate ranges
  onCounts?: (counts: { total: number; flagged: number }) => void;   // live numbers, for the lesson header
}) {
  const t = useTranslations("ingestion");
  const tEl = useTranslations("elements");
  const tEx = useTranslations("exercises");
  const [rows, setRows] = useState<Row[]>(() => initialRows(candidates));
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<RowKind | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [focusedPage, setFocusedPage] = useState<number>(candidates[0] ? candidates[0].page + 1 : range?.[0] ?? 1);

  const counts = useMemo(() => countRows(rows), [rows]);
  const groups = useMemo(() => rowsByKind(rows), [rows]);
  useEffect(() => { onCounts?.({ total: counts.total, flagged: counts.flagged }); }, [counts.total, counts.flagged, onCounts]);
  const active = groups.find(([k]) => k === tab)?.[0] ?? groups[0]?.[0];
  const activeRows = groups.find(([k]) => k === active)?.[1] ?? [];
  const visible = filterRows(activeRows, filter);
  const patch = (id: string, change: Partial<Row>) => setRows((rs) => rs.map((r) => (r.candidate.id === id ? { ...r, ...change } : r)));
  const confirmVerified = () => setRows((rs) => rs.map((r) =>
    ((r.candidate.kind ?? "vocabulary") === active && r.candidate.status === "verified" && !r.deleted && !needsDecision(r) ? { ...r, selected: true } : r)));

  const [merging, setMerging] = useState(false);
  const [reloadingId, setReloadingId] = useState<string | null>(null);
  const [enhanceId, setEnhanceId] = useState<string | null>(null);
  const reload = async (row: Row, request?: string) => {
    setReloadingId(row.candidate.id);
    setError(null);
    try {
      const fresh = await regenerateGrammar(jobId, { title: row.title, explanation: row.explanation, original_text: row.original_text }, request);
      patch(row.candidate.id, { ...fresh, selected: false });   // back to pending: the user checks the new pass
      setEnhanceId(null);
    } catch (e) {
      setError(t("reloadFailed", { message: e instanceof Error ? e.message : "" }));
    } finally {
      setReloadingId(null);
    }
  };
  // an edit that gives the exercise usable content clears the "content needs fixing" warning (the server re-checks on add)
  const editExercise = (row: Row, change: Partial<Row>) => setRows((rs) => rs.map((r) => {
    if (r.candidate.id !== row.candidate.id) return r;
    const fixed = change.content && contentIsValid(r.exercise_type ?? "", change.content as Record<string, unknown>);
    const flags = fixed ? r.candidate.flags.filter((f) => f.code !== "content_invalid") : r.candidate.flags;
    return { ...r, ...change, candidate: { ...r.candidate, flags } };
  }));
  const [regenId, setRegenId] = useState<string | null>(null);
  const exerciseItem = (r: Row): ExerciseItem => ({ exercise_type: r.exercise_type, question: r.question, answer: r.answer, text_support: r.text_support, content: r.content, chunk_id: r.candidate.chunk_id });
  const regenerate = async (row: Row, opts: { exercise_type?: string; request?: string }) => {
    setReloadingId(row.candidate.id);
    setError(null);
    try {
      const { exercise_type, question, answer, text_support, content, status, flags } = await regenerateExercise(jobId, exerciseItem(row), opts);
      // back to pending: the user checks the new pass
      setRows((rs) => rs.map((r) => (r.candidate.id === row.candidate.id
        ? { ...r, exercise_type, question, answer, text_support, content, selected: false, candidate: { ...r.candidate, status, flags } } : r)));
      setRegenId(null);
    } catch (e) {
      setError(t("reloadFailed", { message: e instanceof Error ? e.message : "" }));
    } finally {
      setReloadingId(null);
    }
  };
  // free-text types share one shape (no content), so they switch in place; any other change rebuilds the content with the model
  const changeType = (row: Row, to: string) => {
    if ([row.exercise_type, to].every((x) => ["essay", "answering", "translate"].includes(x ?? ""))) patch(row.candidate.id, { exercise_type: to });
    else regenerate(row, { exercise_type: to });
  };
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  const FILTER_LABEL: Record<Filter, string> = { all: t("filterAll"), verified: t("filterVerified"), flagged: t("filterFlagged"), pending: t("filterPending") };
  const hasConflicts = activeRows.some((r) => !r.deleted && hasConflict(r.candidate));
  const patchMany = (ids: string[], change: (r: Row) => Partial<Row>) => setRows((rs) => rs.map((r) => (ids.includes(r.candidate.id) && !r.deleted ? { ...r, ...change(r) } : r)));
  const merge = async (b: BarProps, exercise_type?: string) => {
    setMerging(true);
    setError(null);
    try {
      const picked = rows.filter((r) => b.ids.includes(r.candidate.id) && !r.deleted);
      if (active === "exercise") {
        // keep the type the ticked cards share (a split type-in-the-blank stays one); mixed types leave the choice to the model
        const types = new Set(picked.map((r) => r.exercise_type));
        const joined = await mergeExercises(jobId, picked.map(exerciseItem), exercise_type ?? (types.size === 1 ? picked[0].exercise_type : undefined));
        setRows((rs) => mergeExerciseRows(rs, b.ids, joined));
        b.onDone(t("bulkMergedDone", { count: picked.length }));
        return;
      }
      const joined = await mergeGrammar(jobId, picked.map((r) => ({ title: r.title, explanation: r.explanation, original_text: r.original_text })));
      setRows((rs) => mergeRows(rs, b.ids, joined));
      b.onDone(t("bulkMergedDone", { count: picked.length }));
    } catch (e) {
      setError(t("mergeFailed", { message: e instanceof Error ? e.message : "" }));
    } finally {
      setMerging(false);
    }
  };
  const reviewBar = (b: BarProps) => {
    const picked = rows.filter((r) => b.ids.includes(r.candidate.id) && !r.deleted);
    const conflicts = picked.filter((r) => hasConflict(r.candidate)).map((r) => r.candidate.id);
    const decide = (on_conflict: "keep" | "overwrite") => {
      patchMany(conflicts, () => ({ selected: true, merged: false, on_conflict }));
      b.onDone(t("bulkApplied", { count: conflicts.length }));
    };
    const canMerge = (active === "grammar" || active === "exercise") && picked.length >= 2 && !merging;
    return (
      <ItemActionBar {...b} userId="" links={false} deleteAction={{ label: t("reject"), icon: <Ban size={20} aria-hidden /> }}
        onDelete={async (ids) => patchMany(ids, () => ({ deleted: true, selected: false }))}
        deleteCopy={{ title: t("deleteRowsTitle", { count: b.ids.length }), body: t("deleteRowsBody"), confirm: t("deleteRowsConfirm", { count: b.ids.length }), done: t("deleteRowsDone", { count: b.ids.length }) }}
        extra={<>
          <button type="button" className="bulk-action" onClick={() => { patchMany(b.ids.filter((id) => !needsDecision(rows.find((r) => r.candidate.id === id)!)), () => ({ selected: true })); b.onDone(t("bulkApplied", { count: picked.length })); }}>
            <Check size={20} aria-hidden />{t("confirm")}
          </button>
          {hasConflicts && <>
            <button type="button" className="bulk-action" disabled={conflicts.length === 0} onClick={() => decide("keep")}><KeepIcon size={20} aria-hidden />{t("keepExisting")}</button>
            <button type="button" className="bulk-action" disabled={conflicts.length === 0} onClick={() => decide("overwrite")}><PenLine size={20} aria-hidden />{t("overwrite")}</button>
          </>}
          <button type="button" className="bulk-action" disabled={!canMerge} title={canMerge ? undefined : t(active === "exercise" ? "mergeNeedsTwoExercises" : "mergeNeedsTwoGrammar")}
            onClick={() => merge(b)}>
            <Combine size={20} aria-hidden />{merging ? t("merging") : tEl("bulkMerge")}
          </button>
        </>} />
    );
  };

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = toAcceptItems(rows);
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
        <p className="text-sm opacity-70">{c.page_end !== undefined && c.page_end > c.page ? t("pageRangeQuote", { from: c.page + 1, to: c.page_end + 1, quote: c.quote }) : t("pageQuote", { page: c.page + 1, quote: c.quote })} <button type="button" className="link underline" onClick={() => setPreview(c.page + 1)}>{t("viewPage")}</button></p>
      </>
    );
    const common = {
      row, footer, onPatch: (change: Partial<Row>) => patch(c.id, change),
      onFocus: () => setFocusedPage(c.page + 1), mergeFields: MERGE_FIELDS[kind], lead: <RowTick kind={SELECT_KIND[kind]} row={row} />,
    };

    if (kind === "grammar") {
      const generated = has("grammar_generated");
      return (
        <ReviewCard {...common} summary={<strong>{row.title}</strong>} onReload={row.original_text ? () => reload(row) : undefined} reloading={reloadingId === c.id}
          onEnhance={() => setEnhanceId(enhanceId === c.id ? null : c.id)}
          footer={<>
            {footer}
            {enhanceId === c.id && <RegenerateForm withRequest withType={false} goLabel={t("enhanceGo")} hint={t("enhanceHint")} busy={reloadingId === c.id}
              onSubmit={(o) => reload(row, o.request ?? t("enhanceDefault"))} onCancel={() => setEnhanceId(null)} />}
          </>}
          preview={row.explanation ? <div className="grammar-preview overflow-x-auto"><Markdown remarkPlugins={[remarkGfm]}>{row.explanation}</Markdown></div> : undefined}
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
              <input className="input" type="number" min={1} step={1} value={row.strokes ?? ""} onChange={(e) => patch(c.id, { strokes: e.target.value || null })} />
            </label>
          </div>
        </ReviewCard>
      );
    }
    if (kind === "exercise") {
      const generated = has("answer_generated");
      const invalid = has("content_invalid");
      return (
        <ReviewCard {...common} summary={
            <select className="input min-h-11 w-auto max-w-full" aria-label={t("changeType")} value={row.exercise_type ?? ""} disabled={reloadingId === c.id}
              onChange={(e) => changeType(row, e.target.value)}>
              {!row.exercise_type && <option value="">{t("exerciseFallback")}</option>}
              {Object.entries(EXERCISE_TYPE_KEY).map(([id, key]) => <option key={id} value={id}>{tEx(key)}</option>)}
            </select>}
          preview={<ExerciseBody row={row} />}
          onReload={() => setRegenId(regenId === c.id ? null : c.id)} reloading={reloadingId === c.id}
          footer={<>
            {footer}
            {regenId === c.id && <RegenerateForm withRequest busy={reloadingId === c.id} onSubmit={(o) => regenerate(row, o)} onCancel={() => setRegenId(null)} />}
          </>}
          badge={invalid ? t("contentInvalid") : has("needs_audio") && !generated ? t("needsAudio") : generated ? t("generatedAnswer") : c.status === "verified" ? t("verifiedBadge") : t("checkBadge")}
          badgeTitle={invalid ? c.flags.find((f) => f.code === "content_invalid")?.message ?? "" : generated ? t("generatedAnswerTitle") : confirmedTitle}>
          <ExerciseEditor row={row} onChange={(p) => editExercise(row, p)} />
        </ReviewCard>
      );
    }
    const generated = has("translation_generated");
    const exists = c.flags.some((f) => f.code.startsWith("already_in_")) && c.existing ? c.existing : null;
    return (
      <ReviewCard {...common} existing={exists}
        summary={<><strong>{row.word}</strong> {row.phonetic && <span className="opacity-70">{row.phonetic} </span>}— {row.translation}{row.word_type && <span className="opacity-60"> ({row.word_type}{row.word_gender && `, ${row.word_gender}`})</span>}</>}
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
          <label className="flex min-w-24 flex-col gap-1">
            <span className="field-label">{t("field_word_gender")}</span>
            <select className="input" value={row.word_gender || ""} onChange={(e) => patch(c.id, { word_gender: e.target.value })}>
              {["", "m", "f", "n", "c"].map((g) => <option key={g} value={g}>{g || "—"}</option>)}
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

        <SelectionScope key={active} canSelect={groups.length > 0} bar={reviewBar} barWidth="max-w-3xl" className="flex flex-col gap-3">
        {groups.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="filter-dropdown" ref={filterRef}>
              <button type="button" className={`btn min-h-11 ${filter === "all" ? "btn-secondary" : "btn-primary"}`} aria-expanded={filterOpen} aria-label={t("filtersLabel")}
                title={t("filtersLabel")} onClick={() => setFilterOpen((o) => !o)}>
                <ListFilter size={18} aria-hidden />
                {filter !== "all" && <span>{FILTER_LABEL[filter]}</span>}
              </button>
              {filterOpen && (
                <div className="filter-panel" role="group" aria-label={t("filtersLabel")}>
                  <div className="filter-chips">
                    {(["pending", "all", "verified", "flagged"] as Filter[]).map((f) => (
                      <button key={f} type="button" className={`filter-chip ${filter === f ? "active" : ""}`} aria-pressed={filter === f}
                        onClick={() => { setFilter(f); setFilterOpen(false); }}>{FILTER_LABEL[f]}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="btn btn-secondary min-h-11" onClick={confirmVerified}>{t("confirmAllVerified")}</button>
            <span className="ml-auto">{active && <SelectToggle kind={SELECT_KIND[active]} />}</span>
          </div>
        )}

        {active && <SelectAllRow kind={SELECT_KIND[active]} entries={visible.filter((r) => !r.deleted).map((r): [string, string] => [r.candidate.id, rowLabel(r)])} />}
        <ul className="m-0 flex list-none flex-col gap-2 p-0" role="tabpanel">{visible.map((r) => <Fragment key={r.candidate.id}>{renderRow(r)}</Fragment>)}</ul>
        </SelectionScope>

        {counts.undecided > 0 && <p role="status" className="text-sm">{t("undecidedNotice", { count: counts.undecided })}</p>}
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
