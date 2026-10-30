"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/dialogs/modal";
import { pageImageUrl } from "@/api/ingestion";
import {
  type AcceptItem, type Candidate, type ConflictMode, type Filter, type Row, countRows, filterRows, infoNotes,
  initialRows, toAcceptItems, warningReasons,
} from "@/lib/ingestion/review";

const CONFLICTS: { value: ConflictMode; label: string }[] = [
  { value: "keep", label: "Keep the existing word" }, { value: "merge", label: "Merge into it" },
  { value: "overwrite", label: "Overwrite it" },
];

// The candidate list shared by lesson-level and language-level imports: confirmed items start checked,
// anything the verifier could not confirm is opt-in, every field is editable, every row links to the real page.
export default function ReviewPanel({ jobId, filename, candidates, addLabel, onAdd }: {
  jobId: string;
  filename: string;
  candidates: Candidate[];
  addLabel: (selected: number) => string;
  onAdd: (items: AcceptItem[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(() => initialRows(candidates));
  const [filter, setFilter] = useState<Filter>("all");
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      setError(e instanceof Error ? e.message : "Could not add the words");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p aria-live="polite">
          {counts.total} found · {counts.verified} confirmed in the text · {counts.flagged} need your check · {counts.selected} selected
        </p>
        <p className="text-xs opacity-60">
          “Confirmed” means the word and its quote appear in the document text. Items that need your check are unselected: compare them with the page before adding.
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

      {counts.total === 0 && <p className="card">No vocabulary was found here.</p>}

      <ul className="flex flex-col gap-2">
        {visible.map((row) => {
          const c = row.candidate;
          const reasons = warningReasons(c);
          const info = infoNotes(c);
          const exists = c.flags.some((f) => f.code.startsWith("already_in_"));
          return (
            <li key={c.id} className="card flex flex-col gap-2">
              <div className="flex flex-wrap items-start gap-3">
                <input type="checkbox" className="mt-3" checked={row.selected} aria-label={`Include ${row.word || "this word"}`}
                  onChange={(e) => patch(c.id, { selected: e.target.checked })} />
                {(["word", "translation", "phonetic", "word_type"] as const).map((key) => (
                  <label key={key} className="flex min-w-32 flex-1 flex-col gap-1">
                    <span className="text-xs opacity-60">{key === "word_type" ? "type" : key}</span>
                    <input className="input" value={row[key]} onChange={(e) => patch(c.id, { [key]: e.target.value })} />
                  </label>
                ))}
                <span className="badge mt-5" title={c.status === "verified" ? "Found in the document text" : "Could not be confirmed"}>
                  {c.status === "verified" ? "✓ Confirmed" : "⚠ Check this"}
                </span>
              </div>
              {reasons.length > 0 && <ul className="list-disc pl-5 text-sm">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              {info.length > 0 && <p className="text-sm opacity-70">ℹ {info.join(" ")}</p>}
              {exists && (
                <label className="flex items-center gap-2 text-sm">
                  If it already exists:
                  <select className="input w-auto" value={row.on_conflict} onChange={(e) => patch(c.id, { on_conflict: e.target.value as ConflictMode })}>
                    {CONFLICTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              )}
              <p className="text-sm opacity-70">
                Page {c.page + 1} · “{c.quote}”{" "}
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

      {preview !== null && (
        <Modal title={`Page ${preview} of ${filename}`} onClose={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pageImageUrl(jobId, preview)} alt={`The original page ${preview} of the document`} className="mx-auto max-h-[70vh]" />
        </Modal>
      )}
    </div>
  );
}
