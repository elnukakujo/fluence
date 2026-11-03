"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Play, Plus, type LucideIcon } from "lucide-react";
import NavButton from "@/components/layout/navButton";
import ScoreDisplay from "@/components/ui/displays/scoreDisplay";
import DifficultyDisplay from "@/components/ui/displays/difficultyDisplay";
import { SelectToggle, useItemSelection, type Kind } from "./itemSelection";

export const average = <T,>(xs: T[], pick: (x: T) => number | undefined) => (xs.length ? xs.reduce((a, x) => a + (pick(x) || 0), 0) / xs.length : 0);

// One feature of a lesson (vocabulary / grammar / calligraphy / exercises): icon + title + count, the lesson's
// averages, the rows (children), and the two actions at the foot. While selecting, the card is outlined and the footer
// swaps for a hint, so nothing navigates away mid-selection.
export default function ListCard({ icon: Icon, title, count, score, difficulty, selectKind, addPath, practicePath, children }: {
  icon: LucideIcon; title: string; count: number; score?: number; difficulty?: number; selectKind?: Kind;   // no selectKind: not selectable here
  addPath: string; practicePath?: string; children?: ReactNode;
}) {
  const t = useTranslations("elements");
  const { isActive } = useItemSelection();
  const selecting = !!selectKind && isActive(selectKind);
  return (
    <section className="card flex flex-col gap-4" data-selecting={selecting} aria-label={title}>
      <header className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon size={20} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg leading-tight">{title}</h2>
          <p className="text-sm text-muted">{t("listTotal", { count })}</p>
        </div>
        {selectKind && count > 0 && <SelectToggle kind={selectKind} />}
      </header>

      {count > 0 && (
        <div className="flex flex-col gap-1 rounded-xl bg-background px-3 py-2">
          <ScoreDisplay score={score ?? 0} />
          <DifficultyDisplay difficulty={difficulty ?? 0} />
        </div>
      )}

      {count === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-3 py-6 text-center">
          <Icon size={24} className="text-muted" aria-hidden />
          <p className="text-sm text-muted">{t("listEmpty")}</p>
        </div>
      ) : children}

      {selecting ? (
        <p className="text-center text-xs text-muted">{t("listSelectHint")}</p>
      ) : (
        <footer className="flex flex-wrap gap-2">
          {practicePath && count > 0 && (
            <NavButton path={practicePath} className="btn btn-primary min-h-11 flex-1"><Play size={16} aria-hidden />{t("listPractice")}</NavButton>
          )}
          <NavButton path={addPath} className={`btn min-h-11 flex-1 ${count === 0 ? "btn-primary" : "btn-secondary"}`}><Plus size={16} aria-hidden />{t("listAdd")}</NavButton>
        </footer>
      )}
    </section>
  );
}
