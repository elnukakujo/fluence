"use client";

import { Fragment, useState, type ReactNode } from "react";
import type { Row } from "@/lib/ingestion/review";
import MergeEditor from "./mergeEditor";

type Existing = Record<string, string | number | null>;

// Compact card for one candidate: summary, trust badge, Confirm / Edit / Delete. Edit reveals the fields (children).
export default function ReviewCard({ row, summary, badge, badgeTitle, existing, mergeFields, onPatch, onFocus, footer, children }: {
  row: Row;
  summary: ReactNode;
  badge: string;
  badgeTitle: string;
  existing?: Existing | null;
  mergeFields?: string[];
  onPatch: (change: Partial<Row>) => void;
  onFocus: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);

  if (row.deleted) {
    return (
      <li className="card flex flex-wrap items-center gap-3 opacity-70" onClick={onFocus}>
        <span className="min-w-0 flex-1 truncate">{existing ? "Kept your existing one" : "Deleted"} · <s>{summary}</s></span>
        <button type="button" className="btn btn-secondary" onClick={() => onPatch({ deleted: false })}>Undo</button>
      </li>
    );
  }

  const shown = existing ? Object.entries(existing).filter(([, v]) => v !== null && v !== "") : [];
  return (
    <li className="card review-card flex flex-col gap-2" data-state={row.selected ? "confirmed" : "pending"} onFocus={onFocus} onClick={onFocus}>
      <p className="review-state text-sm font-semibold">{row.selected ? "✓ Confirmed - will be added" : "To confirm - not added yet"}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 break-words">{summary}</div>
        <span className="badge" title={badgeTitle}>{badge}</span>
      </div>
      {editing && <div className="flex flex-col gap-2">{children}</div>}
      {existing && (
        <div className="existing-box flex flex-col gap-2">
          <p className="font-medium">Already saved</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {shown.map(([k, v]) => (<Fragment key={k}><dt className="field-label">{k.replace("_", " ")}</dt><dd>{String(v)}</dd></Fragment>))}
          </dl>
          <div className="btn-row flex-wrap">
            <button type="button" className="btn btn-secondary" onClick={() => onPatch({ deleted: true })}>Keep existing</button>
            <button type="button" className="btn btn-secondary" onClick={() => onPatch({ selected: true, on_conflict: "overwrite" })}>Overwrite</button>
            <button type="button" className="btn btn-secondary" onClick={() => setMerging(true)}>Merge…</button>
          </div>
          {merging && (
            <MergeEditor existing={existing} incoming={row as unknown as Record<string, string>} fields={mergeFields ?? []}
              onCancel={() => setMerging(false)}
              onDone={(result) => { onPatch({ ...result, selected: true, on_conflict: "overwrite" } as Partial<Row>); setMerging(false); }} />
          )}
        </div>
      )}
      {footer}
      <div className="btn-row flex-wrap">
        <button type="button" className={`btn ${row.selected ? "btn-secondary" : "btn-primary"}`}
          onClick={() => onPatch({ selected: !row.selected })}>{row.selected ? "Undo confirm" : "Confirm"}</button>
        <button type="button" className="btn btn-secondary" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>{editing ? "Done editing" : "Edit"}</button>
        <button type="button" className="btn btn-secondary" onClick={() => onPatch({ deleted: true, selected: false })}>Delete</button>
      </div>
    </li>
  );
}
