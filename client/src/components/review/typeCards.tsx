"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpen, PenLine, Puzzle, ScrollText } from "lucide-react";
import { queueHref } from "@/api/review";
import type { TypeStats } from "@/api/dailyStats";

const ICONS: Record<string, typeof BookOpen> = { vocabulary: BookOpen, grammar: ScrollText, calligraphy: PenLine, exercise: Puzzle };

/** The Type tab of the custom review: one selectable card per studied type (what is due today, how well it is known, what is fading, how much is seen),
 *  and one start bar that stays in view. Components (words, characters, passages) never appear: `types` holds only what the course studies. */
export default function TypeCards({ languageId, types, stats }: { languageId: string; types: string[]; stats?: TypeStats | null }) {
    const t = useTranslations("languages");
    const first = types.length ? (types.reduce((best, type) => ((stats?.[type]?.due ?? 0) > (stats?.[best]?.due ?? 0) ? type : best), types[0])) : "";   // the one with most due
    const [selected, setSelected] = useState(first);
    const current = types.includes(selected) ? selected : first;
    if (types.length === 0) return null;
    const cur = stats?.[current];
    const cards = cur ? (cur.cards ?? cur.total) : undefined;
    return (
        <>
            <div role="radiogroup" aria-label={t("typeCardsLabel")} className="grid gap-3 sm:grid-cols-2">
                {types.map((type) => {
                    const s = stats?.[type];
                    const Icon = ICONS[type] ?? BookOpen;
                    const pct = s && s.seen !== null && s.total ? Math.round((s.seen / s.total) * 100) : null;
                    return (
                        <label key={type} className="group relative block cursor-pointer">
                            <input type="radio" name="review-type" className="peer sr-only" checked={current === type} onChange={() => setSelected(type)} />
                            <span className="card flex min-h-11 flex-col gap-3 border-2 border-transparent transition-colors duration-200 group-hover:border-border peer-checked:border-primary peer-checked:bg-accent-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                                <span className="flex items-center gap-2 text-lg font-semibold"><Icon size={20} aria-hidden />{t(`typeLabel.${type}`)}</span>
                                <span className="grid grid-cols-3 gap-2">
                                    <span className="figure"><b>{s ? s.due : "–"}</b><span>{t("typeDue")}</span></span>
                                    <span className="figure"><b>{s?.mean_seen != null ? Math.round(s.mean_seen) : "–"}</b><span>{t("typeAverage")}</span></span>
                                    <span className="figure"><b>{s?.fading ?? "–"}</b><span>{t("typeFading")}</span></span>
                                </span>
                                {pct !== null && s && (
                                    <span className="flex flex-col gap-1">
                                        <span className="h-2 overflow-hidden rounded-full bg-border" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
                                        <span className="text-xs text-muted">{t("typeSeen", { seen: s.seen ?? 0, total: s.total })}</span>
                                    </span>
                                )}
                                {s && s.seen === null && <span className="text-xs text-muted">{t("typeCount", { total: s.total })}</span>}
                            </span>
                        </label>
                    );
                })}
            </div>
            <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 border-t border-border bg-surface px-1 py-3 md:bottom-0">
                <Link className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto" href={queueHref(languageId, { scope: "type", type: current })}>
                    {t("typeStart", { type: t(`typeLabel.${current}`) })}{cards !== undefined && ` · ${t("typeCount", { total: cards })}`}{cur && cards !== cur.total && ` · ${t("typeWords", { total: cur.total })}`}
                </Link>
            </div>
        </>
    );
}
