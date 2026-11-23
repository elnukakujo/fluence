"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Row } from "@/lib/ingestion/review";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import ReviewCard from "./reviewCard";
import ExerciseBody from "./exerciseBody";
import ExerciseEditor from "./exerciseEditor";
import RegenerateForm from "./regenerateForm";

/** The one card an exercise is reviewed in, whether the parser found it in a document or the generator made it: the type menu (change it and
 *  the exercise is rebuilt), the body, the refresh button that opens the rebuild form, the editor, and Confirm / Edit / Delete. What differs between
 *  the two reviews comes in as props: the badge, the notes, an extra section, and whether Confirm stores at once (`onConfirm`) or ticks the item. */
export default function ExerciseReviewCard({ row, badge, badgeTitle, footer, extra, lead, rebuilding, withRequest, rebuildGoLabel, onPatch, onEdit, onFocus, onChangeType, onRebuild, onConfirm, onDelete, busy }: {
  row: Row;
  badge: string;
  badgeTitle: string;
  footer?: ReactNode;        // notes under the body (warnings, the quote)
  extra?: ReactNode;         // a section under the body (the generated review's associations)
  lead?: ReactNode;          // the select-mode tick
  rebuilding: boolean;       // a rebuild is under way: the type menu and the refresh button wait
  withRequest: boolean;      // the rebuild form has the free-text request (the parser's; the generator takes only a type)
  rebuildGoLabel?: string;
  onPatch: (change: Partial<Row>) => void;    // ticked / deleted state of the parser's row
  onEdit: (change: Partial<Row>) => void;     // a change made in the editor
  onFocus?: () => void;
  onChangeType: (to: string) => void;
  onRebuild: (opts: { exercise_type?: string; request?: string }) => Promise<boolean>;   // true = rebuilt: the form closes
  onConfirm?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("ingestion");
  const tEx = useTranslations("exercises");
  const [formOpen, setFormOpen] = useState(false);
  return (
    <ReviewCard row={row} lead={lead} onPatch={onPatch} onFocus={onFocus ?? (() => {})} badge={badge} badgeTitle={badgeTitle}
      summary={
        <ClassicSelectMenu className="w-64 max-w-full" ariaLabel={t("changeType")} disabled={rebuilding} placeholder={t("exerciseFallback")}
          options={Object.keys(EXERCISE_TYPE_KEY)} optionLabel={(id) => tEx(EXERCISE_TYPE_KEY[id as keyof typeof EXERCISE_TYPE_KEY])}
          selectedOption={row.exercise_type ?? ""} onChange={(v) => onChangeType(v as string)} />}
      preview={<ExerciseBody row={row} />}
      onReload={() => setFormOpen((o) => !o)} reloadOpen={formOpen} reloading={rebuilding}
      onConfirm={onConfirm} onDelete={onDelete} busy={busy}
      footer={<>
        {footer}
        {extra}
        {formOpen && <RegenerateForm withRequest={withRequest} goLabel={rebuildGoLabel} busy={rebuilding}
          onSubmit={async (o) => { if (await onRebuild(o)) setFormOpen(false); }} onCancel={() => setFormOpen(false)} />}
      </>}>
      <ExerciseEditor row={row} onChange={onEdit} />
    </ReviewCard>
  );
}
