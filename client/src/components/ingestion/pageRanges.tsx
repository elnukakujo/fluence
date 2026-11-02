"use client";

import { useTranslations } from "next-intl";
import { type RangeDraft, countPages, parsePageRanges } from "@/lib/ingestion/ranges";

type Props = {
  rows: RangeDraft[];
  onChange: (rows: RangeDraft[]) => void;
  first?: number;
  last?: number;
  errorRow?: number;   // index of the row the message belongs to
  error?: string;
  disabled?: boolean;
};

// One or more page ranges (e.g. vocabulary at the start of a book, calligraphy at the end). At least one row always stays.
export default function PageRanges({ rows, onChange, first = 1, last, errorRow, error, disabled }: Props) {
  const t = useTranslations("ingestion");
  const set = (i: number, change: Partial<RangeDraft>) => onChange(rows.map((r, n) => (n === i ? { ...r, ...change } : r)));
  const parsed = parsePageRanges(rows, first, last);
  const valid = parsed.ok && parsed.ranges ? parsed.ranges : [];
  const add = () => {
    const ends = rows.map((r) => (/^\d+$/.test(r.end.trim()) ? Number(r.end) : 0));
    const start = Math.max(0, ...ends) + 1;
    onChange([...rows, { start: String(last ? Math.min(start, last) : start), end: last ? String(last) : "" }]);
  };
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2 list-none p-0">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs opacity-60">{t("rangeFromLabel")}</span>
                <input className="input" inputMode="numeric" disabled={disabled} value={r.start} onChange={(e) => set(i, { start: e.target.value })} />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs opacity-60">{t("rangeToLabel")}</span>
                <input className="input" inputMode="numeric" disabled={disabled} value={r.end} onChange={(e) => set(i, { end: e.target.value })} />
              </label>
              <button type="button" className="btn btn-secondary min-h-11 min-w-11" disabled={disabled || rows.length === 1}
                aria-label={t("removeRangeAria", { n: i + 1 })} onClick={() => onChange(rows.filter((_, n) => n !== i))}>×</button>
            </div>
            {error && errorRow === i && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-secondary min-h-11" disabled={disabled} onClick={add}>{t("addRange")}</button>
        <span className="text-xs opacity-60" aria-live="polite">{t("rangesSummary", { ranges: valid.length, pages: countPages(valid) })}</span>
      </div>
    </div>
  );
}
