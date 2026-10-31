"use client";

import { Fragment, useMemo, useState } from "react";
import Modal from "@/components/ui/dialogs/modal";
import { pageImageUrl } from "@/api/ingestion";
import {
  type AcceptPayload, type Candidate, type Filter, type Row, type RowKind, countRows, filterRows, infoNotes,
  initialRows, rowsByKind, toAcceptItems, warningReasons, WORD_TYPES,
} from "@/lib/ingestion/review";
import PagePanel from "./pagePanel";
import ReviewCard from "./reviewCard";

const TAB_LABEL: Record<RowKind, string> = { vocabulary: "Vocabulary", grammar: "Grammar", calligraphy: "Calligraphy", exercise: "Exercises" };
const MERGE_FIELDS: Partial<Record<RowKind, string[]>> = {
  vocabulary: ["translation", "phonetic", "word_type"], calligraphy: ["meaning", "phonetic", "radical", "strokes"],
};
const clip = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n)}…` : t);

// The candidate list shared by lesson-level and language-level imports: one tab per kind, each item a compact card
// the user confirms, edits or deletes. Only confirmed items are added; verified ones start confirmed.
export default function ReviewPanel({ jobId, filename, candidates, addLabel, onAdd, range }: {
  jobId: string;
  filename: string;
  candidates: Candidate[];
  addLabel: (selected: number) => string;
  onAdd: (payload: AcceptPayload) => Promise<void>;
  range?: [number, number];
}) {
  const [rows, setRows] = useState<Row[]>(() => initialRows(candidates));
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<RowKind | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [focusedPage, setFocusedPage] = useState<number>(candidates[0] ? candidates[0].page + 1 : range?.[0] ?? 1);

  const counts = useMemo(() => countRows(rows), [rows]);
  const groups = useMemo(() => rowsByKind(rows), [rows]);
  const active = groups.find(([k]) => k === tab)?.[0] ?? groups[0]?.[0];
  const activeRows = groups.find(([k]) => k === active)?.[1] ?? [];
  const visible = filterRows(activeRows, filter);
  const patch = (id: string, change: Partial<Row>) => setRows((rs) => rs.map((r) => (r.candidate.id === id ? { ...r, ...change } : r)));
  const confirmVerified = () => setRows((rs) => rs.map((r) =>
    ((r.candidate.kind ?? "vocabulary") === active && r.candidate.status === "verified" && !r.deleted ? { ...r, selected: true } : r)));

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      await onAdd(toAcceptItems(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the selected items");
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
    const confirmedTitle = c.status === "verified" ? "Found in the document text" : "Could not be confirmed";
    const footer = (
      <>
        {reasons.length > 0 && <ul className="list-disc pl-5 text-sm">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        {info.length > 0 && <p className="text-sm opacity-70">ℹ {info.join(" ")}</p>}
        <p className="text-sm opacity-70">Page {c.page + 1} · "{c.quote}" <button type="button" className="link underline" onClick={() => setPreview(c.page + 1)}>View page</button></p>
      </>
    );
    const common = {
      row, footer, onPatch: (change: Partial<Row>) => patch(c.id, change),
      onFocus: () => setFocusedPage(c.page + 1), mergeFields: MERGE_FIELDS[kind],
    };

    if (kind === "grammar") {
      const generated = has("grammar_generated");
      return (
        <ReviewCard {...common} summary={<><strong>{row.title}</strong> <span className="opacity-70">{clip(row.explanation ?? "")}</span></>}
          badge={generated ? "✎ Generated" : c.status === "verified" ? "✓ Found in text" : "⚠ Check this"}
          badgeTitle={generated ? "Written by the model from the page text - check it" : confirmedTitle}>
          <label className="flex flex-col gap-1">
            <span className="field-label">Title</span>
            <input className="input" value={row.title || ""} onChange={(e) => patch(c.id, { title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Explanation</span>
            <textarea className="input input-grow min-h-40" value={row.explanation || ""} onChange={(e) => patch(c.id, { explanation: e.target.value })} />
          </label>
          {row.original_text && (
            <details className="text-sm">
              <summary className="cursor-pointer">Original page text</summary>
              <p className="mt-2 whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs opacity-70 dark:bg-gray-900">{row.original_text}</p>
            </details>
          )}
        </ReviewCard>
      );
    }
    if (kind === "calligraphy") {
      return (
        <ReviewCard {...common} existing={c.existing} summary={<><span className="mr-2 text-2xl">{row.character}</span>{row.meaning}</>}
          badge={c.status === "verified" ? "✓ Found in text" : "⚠ Check this"} badgeTitle={confirmedTitle}>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-16 flex-col gap-1">
              <span className="field-label">Character</span>
              <input className="input text-center text-2xl" value={row.character || ""} onChange={(e) => patch(c.id, { character: e.target.value })} maxLength={1} />
            </label>
            {(["phonetic", "meaning", "radical"] as const).map((key) => (
              <label key={key} className="flex min-w-24 flex-1 flex-col gap-1">
                <span className="field-label">{key}</span>
                <input className="input" value={row[key] || ""} onChange={(e) => patch(c.id, { [key]: e.target.value })} />
              </label>
            ))}
            <label className="flex min-w-20 flex-col gap-1">
              <span className="field-label">Strokes</span>
              <input className="input" type="number" value={row.strokes ?? ""} onChange={(e) => patch(c.id, { strokes: e.target.value || null })} />
            </label>
          </div>
        </ReviewCard>
      );
    }
    if (kind === "exercise") {
      const generated = has("answer_generated");
      return (
        <ReviewCard {...common} summary={<><span className="badge mr-2">{row.exercise_type || "exercise"}</span>{clip(row.question ?? "")}</>}
          badge={generated ? "✎ Generated answer" : c.status === "verified" ? "✓ Found in text" : "⚠ Check this"}
          badgeTitle={generated ? "The model wrote this answer, not found in the document" : confirmedTitle}>
          <label className="flex flex-col gap-1">
            <span className="field-label">Question</span>
            <textarea className="input input-grow" value={row.question || ""} onChange={(e) => patch(c.id, { question: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Answer</span>
            <textarea className="input input-grow" value={row.answer || ""} onChange={(e) => patch(c.id, { answer: e.target.value })} />
          </label>
          {row.content && <p className="text-sm opacity-70"><strong>Content:</strong> <code className="text-xs">{JSON.stringify(row.content)}</code></p>}
        </ReviewCard>
      );
    }
    const generated = has("translation_generated");
    const exists = c.flags.some((f) => f.code.startsWith("already_in_")) && c.existing ? c.existing : null;
    return (
      <ReviewCard {...common} existing={exists}
        summary={<><strong>{row.word}</strong> {row.phonetic && <span className="opacity-70">{row.phonetic} </span>}— {row.translation}{row.word_type && <span className="opacity-60"> ({row.word_type})</span>}</>}
        badge={generated ? "✎ Generated translation" : c.status === "verified" ? "✓ Found in text" : "⚠ Check this"}
        badgeTitle={generated ? "The document gave no translation; the model wrote this one" : confirmedTitle}>
        <div className="flex flex-wrap gap-3">
          {(["word", "translation", "phonetic"] as const).map((key) => (
            <label key={key} className="flex min-w-32 flex-1 flex-col gap-1">
              <span className="field-label">{key}</span>
              <input className="input" value={row[key] || ""} onChange={(e) => patch(c.id, { [key]: e.target.value })} />
            </label>
          ))}
          <label className="flex min-w-32 flex-col gap-1">
            <span className="field-label">type</span>
            <select className="input" value={row.word_type || ""} onChange={(e) => patch(c.id, { word_type: e.target.value })}>
              {WORD_TYPES.map((t) => <option key={t} value={t}>{t || "—"}</option>)}
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
            {counts.total} found · {counts.verified} found in the text · {counts.flagged} need your check · {counts.selected} to add
          </p>
          <p className="text-xs opacity-60">
            Only items you confirm are added. "Found in the text" means the item and its quote appear in the document; anything written by the model starts unconfirmed: compare it with the page.
          </p>
        </div>

        {groups.length > 0 && (
          <div role="tablist" aria-label="Kinds of element" className="flex flex-wrap gap-x-5 border-b border-gray-300 dark:border-gray-700">
            {groups.map(([k, rs]) => (
              <button key={k} type="button" role="tab" aria-selected={k === active} className="review-tab min-h-11" data-active={k === active}
                onClick={() => setTab(k)}>
                {TAB_LABEL[k]} {rs.filter((r) => !r.deleted).length}
              </button>
            ))}
          </div>
        )}

        {counts.total === 0 && groups.length === 0 && <p className="card">Nothing was found here: no vocabulary, grammar, calligraphy or exercises.</p>}

        {groups.length > 0 && (
          <div className="btn-row flex-wrap">
            {(["all", "verified", "flagged"] as Filter[]).map((f) => (
              <button key={f} type="button" className={`btn ${filter === f ? "btn-primary" : "btn-secondary"}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "verified" ? "Found in the text" : "Need checking"}
              </button>
            ))}
            <button type="button" className="btn btn-secondary" onClick={confirmVerified}>Confirm all verified</button>
          </div>
        )}

        <ul className="m-0 flex list-none flex-col gap-2 p-0" role="tabpanel">{visible.map((r) => <Fragment key={r.candidate.id}>{renderRow(r)}</Fragment>)}</ul>

        {error && <p role="alert" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
        <div className="btn-row flex-wrap">
          <button type="button" className="btn btn-primary" disabled={saving || counts.selected === 0} onClick={add}>
            {saving ? "Adding…" : addLabel(counts.selected)}
          </button>
        </div>
      </div>

      <PagePanel jobId={jobId} page={focusedPage} range={pageSpan} onPage={setFocusedPage} />

      {preview !== null && (
        <Modal title={`Page ${preview} of ${filename}`} onClose={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pageImageUrl(jobId, preview)} alt={`The original page ${preview} of the document`} className="mx-auto max-h-[70vh]" />
        </Modal>
      )}
    </div>
  );
}
