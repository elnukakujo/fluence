"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/dialogs/modal";
import { getAllLessons } from "@/api/lesson";
import { getAllUserTags } from "@/api/tag";
import { getAllUserSources } from "@/api/source";
import { bulkDeleteElements, bulkEditSources, bulkEditTags, bulkMoveElements } from "@/api/element";

type Dialog = "delete" | "move" | "tags" | "sources" | null;
type Named = { id: string; label: string };

// Sticky bar for the selected items; sits above the phone bottom tab bar (3.5rem + safe area).
export default function ItemActionBar({ ids, userId, lessonId, languageId, onDone, onClear }: {
  ids: string[]; userId: string; lessonId: string; languageId: string; onDone: () => void; onClear: () => void;
}) {
  const t = useTranslations("elements");
  const tUi = useTranslations("ui");
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [options, setOptions] = useState<Named[]>([]);
  const [choice, setChoice] = useState<Record<string, "add" | "remove">>({});
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setChoice({}); setTarget(""); setError(null); setOptions([]);
    if (dialog === "move") getAllLessons(languageId).then((ls: { id: string; title: string }[]) => setOptions(ls.filter((l) => l.id !== lessonId).map((l) => ({ id: l.id, label: l.title })))).catch(() => setError(t("bulkLoadFailed")));
    if (dialog === "tags") getAllUserTags(userId).then((ts: { id: string; name: string }[]) => setOptions(ts.map((x) => ({ id: x.id, label: x.name })))).catch(() => setError(t("bulkLoadFailed")));
    if (dialog === "sources") getAllUserSources(userId).then((ss: { id: string; title: string }[]) => setOptions(ss.map((x) => ({ id: x.id, label: x.title })))).catch(() => setError(t("bulkLoadFailed")));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is not stable; the effect must only run when the dialog changes
  }, [dialog, languageId, lessonId, userId]);

  const run = async (job: () => Promise<string>) => {
    setBusy(true); setError(null);
    try { setNotice(await job()); setDialog(null); onDone(); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("bulkFailed")); }
    finally { setBusy(false); }
  };
  const picked = (m: "add" | "remove") => Object.entries(choice).filter(([, v]) => v === m).map(([k]) => k);
  const confirm = () => run(async () => {
    if (dialog === "delete") { await bulkDeleteElements(ids); return t("bulkDeleted", { count: ids.length }); }
    if (dialog === "move") { await bulkMoveElements(ids, target); return t("bulkMoved", { count: ids.length }); }
    const edit = dialog === "tags" ? bulkEditTags : bulkEditSources;
    await edit(ids, picked("add"), picked("remove"));
    return t("bulkUpdated", { count: ids.length });
  });
  const ready = dialog === "move" ? !!target : dialog === "delete" ? true : Object.keys(choice).length > 0;

  return (
    <>
      <div role="region" aria-label={t("bulkActions")}
        className="card sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-40 flex flex-wrap items-center gap-2 md:bottom-4">
        <span className="mr-auto text-sm" aria-live="polite">{t("bulkSelected", { count: ids.length })}</span>
        <button type="button" className="btn btn-secondary min-h-11" onClick={() => setDialog("move")}>{t("bulkMove")}</button>
        <button type="button" className="btn btn-secondary min-h-11" onClick={() => setDialog("tags")}>{t("bulkTags")}</button>
        <button type="button" className="btn btn-secondary min-h-11" onClick={() => setDialog("sources")}>{t("bulkSources")}</button>
        <button type="button" className="btn btn-danger min-h-11" onClick={() => setDialog("delete")}>{t("bulkDelete")}</button>
        <button type="button" className="btn btn-secondary min-h-11" onClick={onClear}>{t("bulkClear")}</button>
      </div>
      <p role="status" className="sr-only">{notice}</p>
      {dialog && (
        <Modal title={t(`bulkTitle_${dialog}`, { count: ids.length })} onClose={() => !busy && setDialog(null)}
          footer={<>
            <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => setDialog(null)}>{tUi("cancel")}</button>
            <button type="button" className={`btn min-h-11 ${dialog === "delete" ? "btn-danger" : "btn-primary"}`} disabled={busy || !ready} onClick={confirm}>
              {busy ? t("bulkWorking") : t(`bulkConfirm_${dialog}`)}
            </button>
          </>}>
          {dialog === "delete" && <p className="text-sm">{t("bulkDeleteBody", { count: ids.length })}</p>}
          {dialog === "move" && (
            <label className="flex flex-col gap-1 text-sm">{t("bulkMoveTo")}
              <select className="min-h-11" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">{t("bulkChooseLesson")}</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          )}
          {(dialog === "tags" || dialog === "sources") && (options.length === 0 && !error ? <p className="text-sm">{t("bulkNone")}</p> : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {options.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">{o.label}</span>
                  <select className="min-h-11" aria-label={o.label} value={choice[o.id] ?? ""}
                    onChange={(e) => setChoice((c) => { const n = { ...c }; if (e.target.value) n[o.id] = e.target.value as "add" | "remove"; else delete n[o.id]; return n; })}>
                    <option value="">{t("bulkLeave")}</option><option value="add">{t("bulkAdd")}</option><option value="remove">{t("bulkRemove")}</option>
                  </select>
                </li>
              ))}
            </ul>
          ))}
          {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
        </Modal>
      )}
    </>
  );
}
