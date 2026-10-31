"use client";

import { useState } from "react";

type Values = Record<string, string | number | null | undefined>;

const show = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

// Existing / new / result side by side; the result starts as the new value and is sent as an overwrite.
export default function MergeEditor({ existing, incoming, fields, onDone, onCancel }: {
  existing: Values;
  incoming: Values;
  fields: string[];
  onDone: (result: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [result, setResult] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f, show(incoming[f]) || show(existing[f])])));
  return (
    <div className="existing-box flex flex-col gap-3" role="group" aria-label="Merge editor">
      <p className="font-medium">Make your own version</p>
      {fields.map((f) => (
        <div key={f} className="flex flex-col gap-1">
          <span className="field-label">{f.replace("_", " ")}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-secondary" aria-label={`Use existing ${f}`} onClick={() => setResult({ ...result, [f]: show(existing[f]) })}>
              Saved: {show(existing[f]) || "—"}
            </button>
            <button type="button" className="btn btn-secondary" aria-label={`Use new ${f}`} onClick={() => setResult({ ...result, [f]: show(incoming[f]) })}>
              New: {show(incoming[f]) || "—"}
            </button>
          </div>
          <input className="input" aria-label={`Result ${f}`} value={result[f]} onChange={(e) => setResult({ ...result, [f]: e.target.value })} />
        </div>
      ))}
      <div className="btn-row flex-wrap">
        <button type="button" className="btn btn-primary" onClick={() => onDone(result)}>Use this version</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
