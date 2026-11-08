"use client";

import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import { contextHint, shapeHint } from "@/utils/cardHints";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Calligraphy from "@/interface/features/Calligraphy";

/** What the card's front already shows at this tier: a hint must never repeat it. */
export interface Shown { detail: boolean; example: boolean }

/** The hint texts of a card in the order they are given: the answer's shape then an example; for a character its strokes and radical then its sound.
 *  A hint the front already shows is left out. */
function useHintLines(card: Vocabulary | Calligraphy, shown: Shown): string[] {
    const t = useTranslations("elements");
    if ("word" in card) {
        const answerIs = card.side === "back" ? "word" : "translation";
        const answer = (answerIs === "word" ? card.word.word : card.word.translation) ?? "";
        const context = shown.example ? null : contextHint(card.example_sentences?.[0], card.word.word ?? "", answerIs);
        return [answer ? t("hintShape", { shape: shapeHint(answer) }) : "", context ? t("hintContext", { sentence: context }) : ""].filter(Boolean);
    }
    const c = card.character;
    const parts = shown.detail ? [] : [c.strokes ? t("strokeCount", { n: c.strokes }) : "", c.radical ? t("hintRadical", { radical: c.radical }) : ""].filter(Boolean);
    return [parts.join(" · "), c.phonetic ? t("hintPhonetic", { phonetic: c.phonetic }) : ""].filter(Boolean);
}

/** A hint strip ABOVE the card, in the flow, so a hint is always where the user is looking: the button, then the hints taken so far beside it.
 *  Each hint limits the best automatic grade (see HINT_CAPS). Nothing the front already shows is repeated. */
export default function HintLadder({ card, level, onHint, shown, children }: { children?: React.ReactNode; card: Vocabulary | Calligraphy; level: number; onHint: () => void; shown: Shown }) {
    const t = useTranslations("elements");
    const lines = useHintLines(card, shown);
    if (!lines.length && !children) return null;
    return (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 min-h-16">   {/* stable height: a hint appearing must not push the card down */}
            {children}
            {lines.length > 0 && (
                <button type="button" className="btn btn-secondary btn-sm min-h-11 inline-flex items-center gap-1.5" disabled={level >= lines.length} onClick={onHint}>
                    <Lightbulb size={14} aria-hidden />{t("hintButton")}
                </button>
            )}
            {level > 0 && (
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 self-center rounded-md border border-border bg-surface px-3 py-1.5" aria-live="polite">
                    {lines.slice(0, level).map((line, i) => <p key={i} className="text-sm">{line}</p>)}
                    <p className="text-xs text-muted">{t("hintCapNote")}</p>
                </div>
            )}
        </div>
    );
}
