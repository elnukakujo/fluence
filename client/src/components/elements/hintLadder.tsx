"use client";

import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import { contextHint, shapeHint } from "@/utils/cardHints";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Calligraphy from "@/interface/features/Calligraphy";

/** The hint texts of a card in the order they are given (level 1, level 2): the answer's shape then an example; for a character its strokes and radical then its sound. */
function useHintLines(card: Vocabulary | Calligraphy): string[] {
    const t = useTranslations("elements");
    if ("word" in card) {
        const answerIs = card.side === "back" ? "word" : "translation";
        const answer = (answerIs === "word" ? card.word.word : card.word.translation) ?? "";
        const context = contextHint(card.example_sentences?.[0], card.word.word ?? "", answerIs);
        return [answer ? t("hintShape", { shape: shapeHint(answer) }) : "", context ? t("hintContext", { sentence: context }) : ""].filter(Boolean);
    }
    const c = card.character;
    const parts = [c.strokes ? t("strokeCount", { n: c.strokes }) : "", c.radical ? t("hintRadical", { radical: c.radical }) : ""].filter(Boolean);
    return [parts.join(" · "), c.phonetic ? t("hintPhonetic", { phonetic: c.phonetic }) : ""].filter(Boolean);
}

/** A hint button in the corner of the card and its hints drawn over the card's bottom, so nothing is pushed down. Each hint limits the best automatic grade (see HINT_CAPS). Place inside a `relative` wrapper. */
export default function HintLadder({ card, level, onHint }: { card: Vocabulary | Calligraphy; level: number; onHint: () => void }) {
    const t = useTranslations("elements");
    const lines = useHintLines(card);
    if (!lines.length) return null;
    return (
        <>
            <button type="button" className="btn btn-secondary btn-sm absolute right-2 top-2 z-10 min-h-11 inline-flex items-center gap-1.5" disabled={level >= lines.length} onClick={onHint}>
                <Lightbulb size={14} aria-hidden />{t("hintButton")}
            </button>
            {level > 0 && (
                <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-1 rounded-md border border-border bg-surface/95 p-2.5 shadow-sm" aria-live="polite">
                    {lines.slice(0, level).map((line, i) => <p key={i} className="text-sm">{line}</p>)}
                    <p className="text-xs text-muted">{t("hintCapNote")}</p>
                </div>
            )}
        </>
    );
}
