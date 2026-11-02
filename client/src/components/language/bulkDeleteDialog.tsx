"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/dialogs/modal";
import { itemCount } from "@/lib/lessonOrder";
import type Lesson from "@/interface/containers/Lesson";

// Lists exactly what will be deleted; Cancel has the initial focus so Enter never deletes by accident.
export default function BulkDeleteDialog({ lessons, onConfirm, onCancel, busy, error }: {
  lessons: Lesson[]; onConfirm: () => void; onCancel: () => void; busy: boolean; error: string | null;
}) {
  const t = useTranslations("language");
  const tUi = useTranslations("ui");
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { const id = setTimeout(() => cancel.current?.focus(), 0); return () => clearTimeout(id); }, []);
  return (
    <Modal
      title={t("deleteLessonsTitle", { count: lessons.length })}
      onClose={() => !busy && onCancel()}
      footer={<>
        <button ref={cancel} type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={onCancel}>{tUi("cancel")}</button>
        <button type="button" className="btn btn-danger min-h-11" disabled={busy} onClick={onConfirm}>
          {busy ? t("deleting") : t("deleteNLessons", { count: lessons.length })}
        </button>
      </>}
    >
      <p className="text-sm">{t("deleteLessonsBody")}</p>
      <ul className="flex list-none flex-col gap-1 p-0">
        {lessons.map((l) => (
          <li key={l.id} className="flex items-baseline justify-between gap-3 text-sm">
            <strong className="truncate">{l.title}</strong>
            <span className="shrink-0 text-muted">{t("lessonItems", { n: itemCount(l) })}</span>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
    </Modal>
  );
}
