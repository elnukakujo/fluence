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

/** A hint button that reveals up to two hints, one at a time. Each hint limits the best grade (see HINT_CAPS). */
export default function HintLadder({ card, level, onHint }: { card: Vocabulary | Calligraphy; level: number; onHint: () => void }) {
    const t = useTranslations("elements");
    const lines = useHintLines(card);
    if (!lines.length) return null;
    return (
        <section className="flex flex-col gap-2" aria-live="polite">
            <button type="button" className="btn btn-secondary min-h-11 self-start inline-flex items-center gap-2" disabled={level >= lines.length} onClick={onHint}>
                <Lightbulb size={14} aria-hidden />{t("hintButton")}
            </button>
            {lines.slice(0, level).map((line, i) => <p key={i} className="text-sm">{line}</p>)}
            {level > 0 && <p className="text-xs text-muted">{t("hintCapNote")}</p>}
        </section>
    );
}
