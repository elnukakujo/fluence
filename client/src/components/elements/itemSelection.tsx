"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, CheckCircle2, ChevronRight, ListChecks } from "lucide-react";
import ItemActionBar from "./itemActionBar";
import Tick from "./tick";

export type Kind = "voc" | "gram" | "call" | "ex";   // = the id prefix of the list's items

type Selection = {
  canSelect: boolean; isActive: (kind: Kind) => boolean; selected: Map<string, string>; // id -> label
  setActive: (kind: Kind, on: boolean) => void; exitAll: () => void; toggle: (id: string, label: string) => void;
  setMany: (entries: [string, string][], on: boolean) => void; clear: () => void; notify: (message: string) => void;
};
const OFF: Selection = {
  canSelect: false, isActive: () => false, selected: new Map(),
  setActive: () => {}, exitAll: () => {}, toggle: () => {}, setMany: () => {}, clear: () => {}, notify: () => {},
};
const Ctx = createContext<Selection>(OFF);
export const useItemSelection = () => useContext(Ctx);

// Shares one selection between the lesson's lists (vocabulary / grammar / calligraphy / exercises), shows the one action bar
// and a short confirmation once an action went through. Escape leaves select mode.
export default function LessonItems({ isOwner, userId, lessonId, languageId, className, children }: {
  isOwner: boolean; userId: string; lessonId: string; languageId: string; className?: string; children: ReactNode;
}) {
  const [activeKinds, setActiveKinds] = useState<Set<Kind>>(new Set());
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const value = useMemo<Selection>(() => ({
    canSelect: isOwner, isActive: (kind) => activeKinds.has(kind), selected,
    // leaving a list's select mode drops only that list's ticks
    setActive: (kind, on) => {
      setActiveKinds((a) => { const n = new Set(a); if (on) n.add(kind); else n.delete(kind); return n; });
      if (!on) setSelected((s) => new Map([...s].filter(([id]) => !id.startsWith(`${kind}_`))));
    },
    exitAll: () => { setActiveKinds(new Set()); setSelected(new Map()); },
    toggle: (id, label) => setSelected((s) => { const n = new Map(s); if (n.has(id)) n.delete(id); else n.set(id, label); return n; }),
    setMany: (entries, on) => setSelected((s) => { const n = new Map(s); for (const [id, label] of entries) { if (on) n.set(id, label); else n.delete(id); } return n; }),
    clear: () => setSelected(new Map()),
    notify: (message) => { setNotice(message); clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(""), 4000); },
  }), [isOwner, activeKinds, selected]);

  useEffect(() => {
    if (activeKinds.size === 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[role=dialog]")) value.exitAll(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeKinds, value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Ctx.Provider value={value}>
      <article className={className}>{children}</article>
      <div className="pointer-events-none sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-40 flex flex-col items-center gap-2 md:bottom-4">
        {notice && <p role="status" className="bulk-toast pointer-events-auto"><CheckCircle2 size={18} aria-hidden /> {notice}</p>}
        {selected.size > 0 && (
          <div className="pointer-events-auto w-full max-w-2xl">
            <ItemActionBar ids={[...selected.keys()]} labels={[...selected.values()]} userId={userId} lessonId={lessonId} languageId={languageId}
              onDone={(message) => { value.exitAll(); value.notify(message); }} onClear={value.clear} onExit={value.exitAll} />
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

// Header control of a list card: a round icon button, which becomes a "Done" pill while selecting.
export function SelectToggle({ kind }: { kind: Kind }) {
  const t = useTranslations("elements");
  const { canSelect, isActive, setActive } = useItemSelection();
  if (!canSelect) return null;
  return isActive(kind) ? (
    <button type="button" className="btn btn-primary min-h-11" aria-label={t("bulkDone")} aria-pressed onClick={() => setActive(kind, false)}><Check size={16} aria-hidden />{t("bulkDone")}</button>
  ) : (
    <button type="button" className="btn btn-secondary h-11 w-11 !p-0" aria-label={t("bulkSelect")} title={t("bulkSelect")} aria-pressed={false} onClick={() => setActive(kind, true)}><ListChecks size={18} aria-hidden /></button>
  );
}

// "Select all" tri-state checkbox over a group of ids (indeterminate when only some are ticked).
export function SelectAllRow({ kind, entries }: { kind: Kind; entries: [string, string][] }) {
  const t = useTranslations("elements");
  const { isActive, selected, setMany } = useItemSelection();
  const box = useRef<HTMLInputElement>(null);
  const n = entries.filter(([id]) => selected.has(id)).length;
  useEffect(() => { if (box.current) box.current.indeterminate = n > 0 && n < entries.length; }, [n, entries.length]);
  if (!isActive(kind) || entries.length === 0) return null;
  return (
    <label className="select-head">
      <input ref={box} type="checkbox" className="tick-input" checked={n === entries.length} onChange={(e) => setMany(entries, e.target.checked)} />
      <Tick />
      <span className="flex-1">{t("bulkSelectAll")}</span>
      <span className="text-xs font-normal text-muted" aria-live="polite">{t("bulkSelectionOf", { selected: n, total: entries.length })}</span>
    </label>
  );
}

type Row = { id: string; main: string; sub?: string; glyph?: boolean };
const labelOf = (r: Row) => (r.sub ? `${r.main} – ${r.sub}` : r.main);
const RowText = ({ r }: { r: Row }) => (
  <span className="min-w-0 flex-1">
    <span className={`pick-main block ${r.glyph ? "pick-glyph" : ""}`}>{r.main}</span>
    {r.sub && <span className="pick-sub block">{r.sub}</span>}
  </span>
);

// One tickable row (also used by the exercises page).
export function SelectBox({ kind, id, label, children }: { kind: Kind; id: string; label: string; children: ReactNode }) {
  const { selected, toggle, isActive } = useItemSelection();
  if (!isActive(kind)) return null;
  return (
    <label className="pick-row" data-selected={selected.has(id)}>
      <input type="checkbox" className="tick-input" checked={selected.has(id)} onChange={() => toggle(id, label)} />
      <Tick />
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </label>
  );
}

// The rows inside a vocabulary / grammar / calligraphy card: open-on-click rows normally, tickable rows (+ select all) in select mode.
export function SelectableList({ kind, items, onOpen }: { kind: Kind; items: Row[]; onOpen: (id: string) => void }) {
  const { isActive, selected, toggle } = useItemSelection();
  const active = isActive(kind);
  return (
    <div className="flex flex-col">
      {active && <SelectAllRow kind={kind} entries={items.map((r) => [r.id, labelOf(r)])} />}
      <ul className="pick-list m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((r) => (
          <li key={r.id}>
            {active ? (
              <label className="pick-row" data-selected={selected.has(r.id)}>
                <input type="checkbox" className="tick-input" checked={selected.has(r.id)} onChange={() => toggle(r.id, labelOf(r))} />
                <Tick />
                <RowText r={r} />
              </label>
            ) : (
              <button type="button" className="pick-row" onClick={() => onOpen(r.id)}>
                <RowText r={r} />
                <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
