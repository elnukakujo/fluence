"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import ItemActionBar from "./itemActionBar";

type Selection = {
  canSelect: boolean; active: boolean; selected: Set<string>;
  setActive: (on: boolean) => void; toggle: (id: string) => void; clear: () => void;
};
const OFF: Selection = { canSelect: false, active: false, selected: new Set(), setActive: () => {}, toggle: () => {}, clear: () => {} };
const Ctx = createContext<Selection>(OFF);
export const useItemSelection = () => useContext(Ctx);

// Shares one selection between the lesson's lists (vocabulary / grammar / calligraphy / exercises) and shows the one action bar.
export default function LessonItems({ isOwner, userId, lessonId, languageId, className, children }: {
  isOwner: boolean; userId: string; lessonId: string; languageId: string; className?: string; children: ReactNode;
}) {
  const [active, setActiveState] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const value = useMemo<Selection>(() => ({
    canSelect: isOwner, active, selected,
    setActive: (on) => { setActiveState(on); if (!on) setSelected(new Set()); },
    toggle: (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    clear: () => setSelected(new Set()),
  }), [isOwner, active, selected]);
  return (
    <Ctx.Provider value={value}>
      <article className={className}>{children}</article>
      {active && selected.size > 0 && <ItemActionBar ids={[...selected]} userId={userId} lessonId={lessonId} languageId={languageId}
        onDone={() => value.setActive(false)} onClear={value.clear} />}
    </Ctx.Provider>
  );
}

export function SelectToggle() {
  const t = useTranslations("elements");
  const { canSelect, active, setActive } = useItemSelection();
  if (!canSelect) return null;
  return (
    <button type="button" className={`btn min-h-11 ${active ? "btn-primary" : "btn-secondary"}`} aria-pressed={active} onClick={() => setActive(!active)}>
      {t("bulkSelect")}
    </button>
  );
}

// A row's checkbox (44px target); the label is the item's own text.
export function SelectBox({ id, children, onlyWhenActive }: { id: string; children: ReactNode; onlyWhenActive?: boolean }) {
  const { selected, toggle, active } = useItemSelection();
  if (onlyWhenActive && !active) return null;
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2">
      <input type="checkbox" className="h-5 w-5" checked={selected.has(id)} onChange={() => toggle(id)} />
      <span className="min-w-0 break-words">{children}</span>
    </label>
  );
}
