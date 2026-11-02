"use client";

import { useTranslations } from "next-intl";

// Sticky action bar for the selected lessons; sits above the phone bottom tab bar (3.5rem + safe area).
export default function ManageBar({ selected, canMerge, onMerge, onDelete, onClear }: {
  selected: number; canMerge: boolean; onMerge: () => void; onDelete: () => void; onClear: () => void;
}) {
  const t = useTranslations("language");
  return (
    <div role="region" aria-label={t("selectionActions")}
      className="card sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-40 flex flex-wrap items-center gap-2 md:bottom-4">
      <span className="mr-auto text-sm" aria-live="polite">{t("selectedCount", { n: selected })}</span>
      <button type="button" className="btn btn-secondary min-h-11" disabled={!canMerge} title={canMerge ? undefined : t("mergeNeedsTwo")} onClick={onMerge}>{t("merge")}</button>
      <button type="button" className="btn btn-danger min-h-11" onClick={onDelete}>{t("deleteSelected")}</button>
      <button type="button" className="btn btn-secondary min-h-11" onClick={onClear}>{t("clearSelection")}</button>
    </div>
  );
}
