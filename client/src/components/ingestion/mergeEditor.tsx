"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Values = Record<string, string | number | null | undefined>;

const show = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

// Existing / new / result side by side; the result starts as the new value and is sent as an overwrite.
const FIELD_KEYS = ["word", "translation", "phonetic", "word_type", "type", "meaning", "radical", "strokes"];
// Field names are identifiers from the API; known ones get a translated label.
export const fieldName = (t: (k: string) => string, f: string) => (FIELD_KEYS.includes(f) ? t(`field_${f}`) : f.replace("_", " "));

export default function MergeEditor({ existing, incoming, fields, onDone, onCancel }: {
  existing: Values;
  incoming: Values;
  fields: string[];
  onDone: (result: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("ingestion");
  const [result, setResult] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f, show(incoming[f]) || show(existing[f])])));
  return (
    <div className="existing-box flex flex-col gap-3" role="group" aria-label={t("mergeEditorLabel")}>
      <p className="font-medium">{t("makeYourOwnVersion")}</p>
      {fields.map((f) => (
        <div key={f} className="flex flex-col gap-1">
          <span className="field-label">{fieldName(t, f)}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-secondary" aria-label={t("useExistingField", { field: fieldName(t, f) })} onClick={() => setResult({ ...result, [f]: show(existing[f]) })}>
              {t("savedValue", { value: show(existing[f]) || "—" })}
            </button>
            <button type="button" className="btn btn-secondary" aria-label={t("useNewField", { field: fieldName(t, f) })} onClick={() => setResult({ ...result, [f]: show(incoming[f]) })}>
              {t("newValue", { value: show(incoming[f]) || "—" })}
            </button>
          </div>
          <input className="input" aria-label={t("resultField", { field: fieldName(t, f) })} value={result[f]} onChange={(e) => setResult({ ...result, [f]: e.target.value })} />
        </div>
      ))}
      <div className="btn-row flex-wrap">
        <button type="button" className="btn btn-primary" onClick={() => onDone(result)}>{t("useThisVersion")}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>{t("cancelButton")}</button>
      </div>
    </div>
  );
}
