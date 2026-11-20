"use client";

import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { HINT_CAPS } from "@/utils/cardHints";

/** The best grade left after `level` hints, as the name of a recall grade (the caps are shared: 1 / 0.75 / 0.5). */
export const bestGradeKey = (level: number) => (["easy", "good", "hard"] as const)[Math.min(level, HINT_CAPS.length - 1)];

/** RC-25: THE hint button, the same on a vocabulary card, a calligraphy card and an exercise: a lightbulb, the word Hint, one pip per step (filled = taken)
 *  and, once a hint is taken, the best grade that is left. Always in the same place (leading edge of the row above the card). */
export default function HintButton({ level, steps, onClick, reopen = false }: { level: number; steps: number; onClick: () => void; reopen?: boolean }) {
    // reopen: a hint that opens a dialog stays pressable after its last step, to read it again at no cost
    const t = useTranslations("elements");
    const tUi = useTranslations("ui");
    const spent = level >= steps && !reopen;
    return (
        <button type="button" onClick={onClick} disabled={spent} className="btn btn-secondary min-h-11 inline-flex items-center gap-2"
            title={spent ? t("hintNoMore") : level >= steps ? t("hintAgain") : t("hintStepOf", { n: level + 1, total: steps })}>
            <Lightbulb size={16} aria-hidden />
            <span>{t("hintButton")}</span>
            <span className="inline-flex items-center gap-1" aria-hidden>
                {Array.from({ length: steps }, (_, i) => <span key={i} className={`h-2 w-2 rounded-full border border-current ${i < level ? "bg-current" : ""}`} />)}
            </span>
            {level > 0 && <span className="text-xs text-muted">{t("hintBest", { grade: tUi(bestGradeKey(level)) })}</span>}
        </button>
    );
}
