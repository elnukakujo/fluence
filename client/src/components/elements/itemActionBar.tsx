"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FolderInput, Library, Tags, Trash2, X } from "lucide-react";
import { DeleteDialog, LinksDialog, MoveDialog } from "./itemActionDialogs";

type Dialog = "delete" | "move" | "tags" | "sources" | null;

// Floating toolbar for the ticked items: count + exit on the left, actions on the right (delete set apart, in red).
export default function ItemActionBar({ ids, labels, userId, lessonId, languageId, onDone, onClear, onExit }: {
  ids: string[]; labels: string[]; userId: string; lessonId: string; languageId: string;
  onDone: (message: string) => void; onClear: () => void; onExit: () => void;
}) {
  const t = useTranslations("elements");
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const done = (message: string) => { close(); onDone(message); };

  return (
    <>
      <div role="region" aria-label={t("bulkActions")} className="bulk-bar">
        <span className="bulk-count">
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface" aria-label={t("bulkExit")} onClick={onExit}><X size={16} aria-hidden /></button>
          <span aria-live="polite">{t("bulkSelected", { count: ids.length })}</span>
        </span>
        <button type="button" className="bulk-action" onClick={() => setDialog("move")}><FolderInput size={20} aria-hidden />{t("bulkMove")}</button>
        <button type="button" className="bulk-action" onClick={() => setDialog("tags")}><Tags size={20} aria-hidden />{t("bulkTags")}</button>
        <button type="button" className="bulk-action" onClick={() => setDialog("sources")}><Library size={20} aria-hidden />{t("bulkSources")}</button>
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
        <button type="button" className="bulk-action" data-danger="true" onClick={() => setDialog("delete")}><Trash2 size={20} aria-hidden />{t("bulkDelete")}</button>
      </div>
      {dialog === "delete" && <DeleteDialog ids={ids} labels={labels} onClose={close} onDone={done} />}
      {dialog === "move" && <MoveDialog ids={ids} labels={labels} lessonId={lessonId} languageId={languageId} onClose={close} onDone={done} />}
      {(dialog === "tags" || dialog === "sources") && <LinksDialog kind={dialog === "tags" ? "tag" : "source"} ids={ids} labels={labels} userId={userId} onClose={close} onDone={done} />}
    </>
  );
}
