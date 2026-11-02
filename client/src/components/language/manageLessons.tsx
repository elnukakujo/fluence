"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";
import type Lesson from "@/interface/containers/Lesson";
import { bulkDeleteLessons, reorderLessons } from "@/api/lesson";
import { itemCount, moveItem } from "@/lib/lessonOrder";
import BulkDeleteDialog from "./bulkDeleteDialog";
import ManageBar from "./manageBar";

// Manage mode of the language page: select lessons (merge / delete) and reorder them with up/down buttons
// (dragging is deliberately not the only way to reorder: buttons work by keyboard, screen reader and touch).
export default function ManageLessons({ lessons, languageId, visibleIds, reorderLocked }: {
  lessons: Lesson[]; languageId: string; visibleIds: Set<string>; reorderLocked: boolean;
}) {
  const t = useTranslations("language");
  const router = useRouter();
  const owned = lessons.filter((l) => !l.shared);
  const shared = lessons.filter((l) => l.shared);
  const [order, setOrder] = useState<string[]>(() => owned.map((l) => l.id));
  const [selected, setSelected] = useState<string[]>([]);
  const [announce, setAnnounce] = useState(""); // screen-reader only
  const [notice, setNotice] = useState("");     // visible
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; dir: "up" | "down" } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const byId = new Map(owned.map((l) => [l.id, l]));

  useEffect(() => {
    if (!focus) return;
    const el = (dir: string) => document.getElementById(`move-${focus.id}-${dir}`) as HTMLButtonElement | null;
    const target = el(focus.dir);
    (target && !target.disabled ? target : el(focus.dir === "up" ? "down" : "up"))?.focus();
    setFocus(null);
  }, [order, focus]);

  const move = async (id: string, dir: "up" | "down") => {
    const from = order.indexOf(id);
    const to = from + (dir === "up" ? -1 : 1);
    const previous = order;
    setOrder(moveItem(order, from, to));
    setFocus({ id, dir });
    setError(null);
    try {
      await reorderLessons(languageId, moveItem(previous, from, to));
      setAnnounce(t("movedTo", { title: byId.get(id)?.title ?? "", n: to + 1 }));
      router.refresh(); // the lesson grid renders server-fetched props; reload them so the new order shows without a manual refresh
    } catch {
      setOrder(previous);
      setError(t("reorderFailed"));
    }
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const inOrder = order.filter((id) => selected.includes(id)); // selection in list order, whatever the click order
  const doomed = inOrder.map((id) => byId.get(id)!).filter(Boolean);

  const confirmDelete = async () => {
    setBusy(true);
    setDeleteError(null);
    try {
      await bulkDeleteLessons(inOrder);
      setOrder((o) => o.filter((id) => !inOrder.includes(id)));
      setNotice(t("deletedN", { count: inOrder.length }));
      setSelected([]);
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t("deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  const shown = order.filter((id) => visibleIds.has(id));
  return (
    <div className="flex flex-col gap-3">
      {reorderLocked && <p className="text-sm text-muted">{t("filterHidesReorder")}</p>}
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <ul className="flex list-none flex-col gap-2 p-0">
        {shown.map((id) => {
          const lesson = byId.get(id)!;
          const i = order.indexOf(id);
          return (
            <li key={id} className="card flex items-center gap-3 !py-2">
              <input type="checkbox" className="h-5 w-5" checked={selected.includes(id)} aria-label={t("selectLesson", { title: lesson.title })} onChange={() => toggle(id)} />
              <span className="min-w-0 flex-1">
                <strong className="block truncate">{lesson.title}</strong>
                <span className="text-xs text-muted">{t("lessonItems", { n: itemCount(lesson) })}</span>
              </span>
              {!reorderLocked && (
                <span className="flex gap-2">
                  <button id={`move-${id}-up`} type="button" className="btn btn-secondary min-h-11 min-w-11" disabled={i === 0}
                    aria-label={t("moveUp", { title: lesson.title })} onClick={() => move(id, "up")}><ArrowUp size={16} aria-hidden /></button>
                  <button id={`move-${id}-down`} type="button" className="btn btn-secondary min-h-11 min-w-11" disabled={i === order.length - 1}
                    aria-label={t("moveDown", { title: lesson.title })} onClick={() => move(id, "down")}><ArrowDown size={16} aria-hidden /></button>
                </span>
              )}
            </li>
          );
        })}
        {shared.map((lesson) => (
          <li key={lesson.id} className="card flex items-center gap-3 !py-2 opacity-70">
            <span className="min-w-0 flex-1"><strong className="block truncate">{lesson.title}</strong><span className="text-xs text-muted">{t("sharedNotManageable")}</span></span>
          </li>
        ))}
      </ul>
      {selected.length > 0 && (
        <ManageBar selected={selected.length} canMerge={selected.length === 2}
          onMerge={() => router.push(`/languages/${languageId}/merge?a=${inOrder[0]}&b=${inOrder[1]}`)}
          onDelete={() => { setDeleteError(null); setConfirming(true); }} onClear={() => setSelected([])} />
      )}
      {confirming && <BulkDeleteDialog lessons={doomed} busy={busy} error={deleteError} onConfirm={confirmDelete} onCancel={() => setConfirming(false)} />}
    </div>
  );
}
