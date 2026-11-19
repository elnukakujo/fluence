"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type Grammar from "@/interface/features/Grammar";
import { getGrammarById } from "@/api/grammar";
import GrammarCard from "@/components/elements/grammarCard";
import { TIER_LEARNING_DIFFICULTY } from "@/utils/cardTier";

/** RC-22: the grammar sheet is offered after a failed answer, a hint, or when the grammar is still hard for the learner (difficulty above the learning tier's). */
export const sheetOpen = ({ failed, hintUsed, difficulty }: { failed: boolean; hintUsed: boolean; difficulty: number }) =>
    failed || hintUsed || difficulty > TIER_LEARNING_DIFFICULTY;

/** The exercise's linked grammars, each as a collapsed sheet, for the grammars that qualify (`sheetOpen`); nothing otherwise. */
export default function LinkedGrammarSheet({ grammarIds, failed, hintUsed }: { grammarIds: string[]; failed: boolean; hintUsed: boolean }) {
    const t = useTranslations("exercises");
    const [grammars, setGrammars] = useState<Grammar[]>([]);
    const key = grammarIds.join(",");
    useEffect(() => {
        let stale = false;
        Promise.all(grammarIds.map((id) => getGrammarById(id))).then((g) => { if (!stale) setGrammars(g); }).catch(() => { if (!stale) setGrammars([]); });
        return () => { stale = true; };
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
    const shown = grammars.filter((g) => sheetOpen({ failed, hintUsed, difficulty: (g as { difficulty?: number }).difficulty ?? 0 }));
    if (!shown.length) return null;
    return (
        <div className="flex flex-col gap-2">
            {shown.map((g) => (
                <details key={g.id} className="card">
                    <summary className="cursor-pointer font-medium">{t("grammarSheet", { title: g.title })}</summary>
                    <div className="mt-3"><GrammarCard grammar={g} /></div>
                </details>
            ))}
        </div>
    );
}
