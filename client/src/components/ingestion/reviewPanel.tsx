"use client";

import { Fragment, useMemo, useState } from "react";
import Modal from "@/components/ui/dialogs/modal";
import { pageImageUrl } from "@/api/ingestion";
import {
  type AcceptPayload, type Candidate, type ConflictMode, type Filter, type Row, countRows, filterRows, infoNotes,
  initialRows, toAcceptItems, warningReasons, WORD_TYPES,
} from "@/lib/ingestion/review";
import PagePanel from "./pagePanel";

const CONFLICTS: { value: ConflictMode; label: string }[] = [
  { value: "keep", label: "Keep the existing one" }, { value: "merge", label: "Merge into it" },
  { value: "overwrite", label: "Overwrite it" },
];

// "Already saved" box + the keep/merge/overwrite choice, shown beside the candidate so the user can compare.
function ExistingBox({ existing, mode, onMode }: { existing: Record<string, string | number | null>; mode: ConflictMode; onMode: (m: ConflictMode) => void }) {
  const shown = Object.entries(existing).filter(([, v]) => v !== null && v !== "");
  return (
    <div className="existing-box flex flex-col gap-2">
      <p className="font-medium">Already saved in your language</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {shown.map(([k, v]) => (<Fragment key={k}><dt className="field-label">{k.replace("_", " ")}</dt><dd>{String(v)}</dd></Fragment>))}
      </dl>
      <label className="flex flex-wrap items-center gap-2">
        If it already exists:
        <select className="input w-auto" value={mode} onChange={(e) => onMode(e.target.value as ConflictMode)}>
          {CONFLICTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    </div>
  );
}

// The candidate list shared by lesson-level and language-level imports: confirmed items start checked,
// anything the verifier could not confirm is opt-in, every field is editable, every row links to the real page.
export default function ReviewPanel({ jobId, filename, candidates, addLabel, onAdd, pageCount }: {
  jobId: string;
  filename: string;
  candidates: Candidate[];
  addLabel: (selected: number) => string;
  onAdd: (payload: AcceptPayload) => Promise<void>;
  pageCount?: number;
}) {
  const [rows, setRows] = useState<Row[]>(() => initialRows(candidates));
  const [filter, setFilter] = useState<Filter>("all");
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [focusedPage, setFocusedPage] = useState<number>((candidates[0]?.page ?? 0) + 1);
  const [panelOpen, setPanelOpen] = useState(false);

  const counts = useMemo(() => countRows(rows), [rows]);
  const visible = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const patch = (id: string, change: Partial<Row>) => setRows((rs) => rs.map((r) => (r.candidate.id === id ? { ...r, ...change } : r)));
  const toggleVerified = (on: boolean) => setRows((rs) => rs.map((r) => (r.candidate.status === "verified" ? { ...r, selected: on } : r)));

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

  const effectivePageCount = pageCount ?? (candidates.length > 0 ? Math.max(...candidates.map((c) => c.page + 1)) : 1);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p aria-live="polite">
            {counts.total} found · {counts.verified} confirmed in the text · {counts.flagged} need your check · {counts.selected} selected
          </p>
          <p className="text-xs opacity-60">
            "Confirmed" means the item and its quote appear in the document text. Anything written by the model, or not confirmed, is unselected: compare it with the page on the right before adding.
          </p>
          <div className="btn-row">
            {(["all", "verified", "flagged"] as Filter[]).map((f) => (
              <button key={f} type="button" className={`btn ${filter === f ? "btn-primary" : "btn-secondary"}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "verified" ? "Confirmed" : "Need checking"}
              </button>
            ))}
            <button type="button" className="btn btn-secondary" onClick={() => toggleVerified(true)}>Select all confirmed</button>
            <button type="button" className="btn btn-secondary" onClick={() => toggleVerified(false)}>Clear confirmed</button>
          </div>
        </div>

        {counts.total === 0 && <p className="card">Nothing was found here: no vocabulary, grammar, calligraphy or exercises.</p>}

        <ul className="flex flex-col gap-2">
        {visible.map((row) => {
          const c = row.candidate;
          const reasons = warningReasons(c);
          const info = infoNotes(c);
          const exists = c.flags.some((f) => f.code.startsWith("already_in_"));
          const generated = c.flags.some((f) => f.code === "translation_generated");

          if (c.kind === "grammar") {
            const grammarGenerated = c.flags.some((f) => f.code === "grammar_generated");
            return (
              <li key={c.id} className="card flex flex-col gap-2" onFocus={() => setFocusedPage(c.page + 1)} onClick={() => setFocusedPage(c.page + 1)}>
                <div className="flex flex-wrap items-start gap-3">
                  <input type="checkbox" className="mt-3" checked={row.selected} aria-label={`Include ${row.title || "grammar"}`}
                    onChange={(e) => patch(c.id, { selected: e.target.checked })} />
                  <label className="flex min-w-48 flex-1 flex-col gap-1">
                    <span className="text-xs opacity-60">Title</span>
                    <input className="input" value={row.title || ""} onChange={(e) => patch(c.id, { title: e.target.value })} />
                  </label>
                  <span className="badge mt-5" title={grammarGenerated ? "Written by the model from the page text - check it" : c.status === "verified" ? "Found in the document text" : "Could not be confirmed"}>
                    {grammarGenerated ? "✎ Generated" : c.status === "verified" ? "✓ Confirmed" : "⚠ Check this"}
                  </span>
                </div>
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
                {reasons.length > 0 && <ul className="list-disc pl-5 text-sm">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                {info.length > 0 && <p className="text-sm opacity-70">ℹ {info.join(" ")}</p>}
                <p className="text-sm opacity-70">Page {c.page + 1} · "{c.quote}" <button type="button" className="link underline" onClick={() => setPreview(c.page + 1)}>View page</button></p>
              </li>
            );
          } else if (c.kind === "calligraphy") {
            return (
              <li key={c.id} className="card flex flex-col gap-2" onFocus={() => setFocusedPage(c.page + 1)} onClick={() => setFocusedPage(c.page + 1)}>
                <div className="flex flex-wrap items-start gap-3">
                  <input type="checkbox" className="mt-3" checked={row.selected} aria-label={`Include calligraphy ${row.character || ""}`}
                    onChange={(e) => patch(c.id, { selected: e.target.checked })} />
                  <label className="flex min-w-16 flex-col gap-1">
                    <span className="text-xs opacity-60">Character</span>
                    <input className="input text-center text-2xl" value={row.character || ""} onChange={(e) => patch(c.id, { character: e.target.value })} maxLength={1} />
                  </label>
                  <label className="flex min-w-24 flex-col gap-1">
                    <span className="text-xs opacity-60">Phonetic</span>
                    <input className="input" value={row.phonetic || ""} onChange={(e) => patch(c.id, { phonetic: e.target.value })} />
                  </label>
                  <label className="flex min-w-32 flex-col gap-1">
                    <span className="text-xs opacity-60">Meaning</span>
                    <input className="input" value={row.meaning || ""} onChange={(e) => patch(c.id, { meaning: e.target.value })} />
                  </label>
                  <label className="flex min-w-24 flex-col gap-1">
                    <span className="text-xs opacity-60">Radical</span>
                    <input className="input" value={row.radical || ""} onChange={(e) => patch(c.id, { radical: e.target.value })} />
                  </label>
                  <label className="flex min-w-20 flex-col gap-1">
                    <span className="text-xs opacity-60">Strokes</span>
                    <input className="input" type="number" value={row.strokes ?? ""} onChange={(e) => patch(c.id, { strokes: e.target.value ? (parseInt(e.target.value, 10) as any) : null })} />
                  </label>
                  <span className="badge mt-5" title={c.status === "verified" ? "Found in the document text" : "Could not be confirmed"}>
                    {c.status === "verified" ? "✓ Confirmed" : "⚠ Check this"}
                  </span>
                </div>
                {c.existing && <ExistingBox existing={c.existing} mode={row.on_conflict} onMode={(m) => patch(c.id, { on_conflict: m })} />}
                {reasons.length > 0 && <ul className="list-disc pl-5 text-sm">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                {info.length > 0 && <p className="text-sm opacity-70">ℹ {info.join(" ")}</p>}
                <p className="text-sm opacity-70">Page {c.page + 1} · "{c.quote}" <button type="button" className="link underline" onClick={() => setPreview(c.page + 1)}>View page</button></p>
              </li>
            );
          } else if (c.kind === "exercise") {
            const answerGenerated = c.flags.some((f) => f.code === "answer_generated");
            return (
              <li key={c.id} className="card flex flex-col gap-2" onFocus={() => setFocusedPage(c.page + 1)} onClick={() => setFocusedPage(c.page + 1)}>
                <div className="flex flex-wrap items-center gap-3">
                  <input type="checkbox" checked={row.selected} aria-label="Include exercise"
                    onChange={(e) => patch(c.id, { selected: e.target.checked })} />
                  <span className="badge" title="Exercise type">{row.exercise_type || "exercise"}</span>
                  <span className="badge" title={answerGenerated ? "The model wrote this answer, not found in the document" : c.status === "verified" ? "Found in the document text" : "Could not be confirmed"}>
                    {answerGenerated ? "✎ Generated answer" : c.status === "verified" ? "✓ Confirmed" : "⚠ Check this"}
                  </span>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="field-label">Question</span>
                  <textarea className="input input-grow" value={row.question || ""} onChange={(e) => patch(c.id, { question: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="field-label">Answer</span>
                  <textarea className="input input-grow" value={row.answer || ""} onChange={(e) => patch(c.id, { answer: e.target.value })} />
                </label>
                {row.content && <p className="text-sm opacity-70"><strong>Content:</strong> <code className="text-xs">{JSON.stringify(row.content)}</code></p>}
                {reasons.length > 0 && <ul className="list-disc pl-5 text-sm">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                {info.length > 0 && <p className="text-sm opacity-70">ℹ {info.join(" ")}</p>}
                <p className="text-sm opacity-70">Page {c.page + 1} · "{c.quote}" <button type="button" className="link underline" onClick={() => setPreview(c.page + 1)}>View page</button></p>
              </li>
            );
          }

          return (
            <li key={c.id} className="card flex flex-col gap-2" onFocus={() => setFocusedPage(c.page + 1)} onClick={() => setFocusedPage(c.page + 1)}>
              <div className="flex flex-wrap items-start gap-3">
                <input type="checkbox" className="mt-3" checked={row.selected} aria-label={`Include ${row.word || "this word"}`}
                  onChange={(e) => patch(c.id, { selected: e.target.checked })} />
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
                <span className="badge mt-5" title={generated ? "The document gave no translation; the model wrote this one" : c.status === "verified" ? "Found in the document text" : "Could not be confirmed"}>
                  {generated ? "✎ Generated translation" : c.status === "verified" ? "✓ Confirmed" : "⚠ Check this"}
                </span>
              </div>
              {reasons.length > 0 && <ul className="list-disc pl-5 text-sm">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              {info.length > 0 && <p className="text-sm opacity-70">ℹ {info.join(" ")}</p>}
              {exists && c.existing && <ExistingBox existing={c.existing} mode={row.on_conflict} onMode={(m) => patch(c.id, { on_conflict: m })} />}
              <p className="text-sm opacity-70">
                Page {c.page + 1} · "{c.quote}"{" "}
                <button type="button" className="link underline" onClick={() => setPreview(c.page + 1)}>View page</button>
              </p>
            </li>
          );
        })}
        </ul>

        {error && <p role="alert" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" disabled={saving || counts.selected === 0} onClick={add}>
            {saving ? "Adding…" : addLabel(counts.selected)}
          </button>
        </div>
      </div>

      <div className="lg:w-80 xl:w-96">
        <button type="button" className="btn btn-secondary mb-2 lg:hidden" aria-expanded={panelOpen} onClick={() => setPanelOpen((o) => !o)}>
          {panelOpen ? "Hide the page" : "Show the original page"}
        </button>
        <div className={`${panelOpen ? "block" : "hidden"} lg:block lg:sticky lg:top-4`}>
          <PagePanel jobId={jobId} page={focusedPage} pageCount={effectivePageCount} onPage={setFocusedPage} />
        </div>
      </div>

      {preview !== null && (
        <Modal title={`Page ${preview} of ${filename}`} onClose={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pageImageUrl(jobId, preview)} alt={`The original page ${preview} of the document`} className="mx-auto max-h-[70vh]" />
        </Modal>
      )}
    </div>
  );
}
