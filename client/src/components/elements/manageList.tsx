"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { moveItem } from "@/lib/lessonOrder";
import { SelectAllRow, useItemSelection, type Kind } from "./itemSelection";
import Tick from "./tick";

export type ManageItem = { id: string; title: string; subtitle?: string; owned: boolean };

// Select mode of a page's container list (lessons of a language, languages of the home page): tickable rows + select all,
// and reordering by drag and drop or up / down buttons (buttons too, so keyboard, screen reader and touch work).
// Rows you do not own are listed but neither tickable nor movable. `onReorder` saves the owned ids in their new order.
export default function ManageList({ kind, items, onReorder, reorderLocked = false }: {
  kind: Kind; items: ManageItem[]; onReorder: (ids: string[]) => Promise<unknown>; reorderLocked?: boolean;
}) {
  const t = useTranslations("language");
  const router = useRouter();
  const { selected, toggle } = useItemSelection();
  const owned = items.filter((i) => i.owned);
  const others = items.filter((i) => !i.owned);
  const byId = new Map(owned.map((i) => [i.id, i]));
  const [order, setOrder] = useState<string[]>(() => owned.map((i) => i.id));
  const [announce, setAnnounce] = useState("");   // screen-reader only
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; dir: "up" | "down" } | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<{ index: number; after: boolean } | null>(null);   // where the dragged row would land
  const dragRef = useRef<string | null>(null);   // read by the drop handler: state may not have flushed yet
  const key = owned.map((i) => i.id).join(",");
  useEffect(() => setOrder(key ? key.split(",") : []), [key]);   // the server sent a new list (after a delete, a reorder...)

  useEffect(() => {
    if (!focus) return;
    const el = (dir: string) => document.getElementById(`move-${focus.id}-${dir}`) as HTMLButtonElement | null;
    const target = el(focus.dir);
    (target && !target.disabled ? target : el(focus.dir === "up" ? "down" : "up"))?.focus();
    setFocus(null);
  }, [order, focus]);

  const endDrag = () => { dragRef.current = null; setDragged(null); setOver(null); };
  // index the dragged row ends at when dropped before / after row `over.index` (removing it first shifts later slots up by one)
  const landing = (from: number, o: { index: number; after: boolean }) => { const slot = o.index + (o.after ? 1 : 0); return slot > from ? slot - 1 : slot; };

  const move = async (id: string, to: number, dir?: "up" | "down") => {
    const from = order.indexOf(id);
    const next = moveItem(order, from, to);
    if (next.join() === order.join()) return;
    const previous = order;
    setOrder(next);
    if (dir) setFocus({ id, dir });
    setError(null);
    try {
      await onReorder(next);
      setAnnounce(t("movedTo", { title: byId.get(id)?.title ?? "", n: to + 1 }));
      router.refresh();   // the plain grid renders server-fetched props; reload them so the new order shows without a manual refresh
    } catch {
      setOrder(previous);
      setError(t("reorderFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {reorderLocked && <p className="text-sm text-muted">{t("filterHidesReorder")}</p>}
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      <SelectAllRow kind={kind} entries={order.filter((id) => byId.has(id)).map((id) => [id, byId.get(id)!.title])} />
      <ul className="flex list-none flex-col gap-2 p-0">
        {order.map((id, i) => {
          const item = byId.get(id);
          if (!item) return null;
          return (
            <li key={id} className="card relative flex items-center gap-3 !py-2 data-[dragging=true]:opacity-50" data-dragging={dragged === id}
              draggable={!reorderLocked}
              onDragStart={(e) => { dragRef.current = id; /* the grip image follows the row */ setDragged(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); /* Firefox needs data to start a drag */ }}
              onDragOver={(e) => {
                if (!dragRef.current) return;
                e.preventDefault(); e.dataTransfer.dropEffect = "move";
                const r = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > r.top + r.height / 2;
                setOver((o) => (o && o.index === i && o.after === after ? o : { index: i, after }));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragRef.current;
                if (from && over) move(from, landing(order.indexOf(from), over));
                endDrag();
              }}
              onDragEnd={endDrag}>
              {over && dragged !== id && over.index === i && landing(order.indexOf(dragged ?? ""), over) !== order.indexOf(dragged ?? "") && (
                <span aria-hidden className="pointer-events-none absolute inset-x-0 h-1 rounded-full bg-primary"
                  style={over.after ? { bottom: "-0.375rem" } : { top: "-0.375rem" }} />
              )}
              {!reorderLocked && <GripVertical size={18} className="shrink-0 cursor-grab text-muted" aria-hidden />}
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input type="checkbox" className="tick-input" checked={selected.has(id)} aria-label={t("selectLesson", { title: item.title })} onChange={() => toggle(id, item.title)} />
                <Tick />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{item.title}</strong>
                  {item.subtitle && <span className="text-xs text-muted">{item.subtitle}</span>}
                </span>
              </label>
              {!reorderLocked && (
                <span className="flex gap-2">
                  <button id={`move-${id}-up`} type="button" className="btn btn-secondary min-h-11 min-w-11" disabled={i === 0}
                    aria-label={t("moveUp", { title: item.title })} onClick={() => move(id, i - 1, "up")}><ArrowUp size={16} aria-hidden /></button>
                  <button id={`move-${id}-down`} type="button" className="btn btn-secondary min-h-11 min-w-11" disabled={i === order.length - 1}
                    aria-label={t("moveDown", { title: item.title })} onClick={() => move(id, i + 1, "down")}><ArrowDown size={16} aria-hidden /></button>
                </span>
              )}
            </li>
          );
        })}
        {others.map((item) => (
          <li key={item.id} className="card flex items-center gap-3 !py-2 opacity-70">
            <span className="min-w-0 flex-1"><strong className="block truncate">{item.title}</strong><span className="text-xs text-muted">{t("sharedNotManageable")}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
