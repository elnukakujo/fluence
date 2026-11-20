"use client";

import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import HintButton from "./hintButton";
import { contextHint, shapeHint } from "@/utils/cardHints";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Calligraphy from "@/interface/features/Calligraphy";

/** What the card's front already shows at this tier: a hint must never repeat it. */
export interface Shown { detail: boolean; example: boolean }

/** The hint steps of a card, in the order they are given (RC-25). A hint the front already shows is left out, and a card with little to give still gets steps
 *  (the lesson it comes from), so the button never vanishes. */
function useHintLines(card: Vocabulary | Calligraphy, shown: Shown): string[] {
    const t = useTranslations("elements");
    const lesson = (card as { lesson_title?: string }).lesson_title;
    const fromLesson = lesson ? [t("hintLesson", { lesson })] : [];
    let lines: string[];
    if ("word" in card) {
        const w = card.word;
        const answerIs = card.side === "back" ? "word" : "translation";
        const answer = (answerIs === "word" ? w.word : w.translation) ?? "";
        const length = [...answer.replace(/\s+/g, "")].length;
        const context = shown.example ? null : contextHint(card.example_sentences?.[0], w.word ?? "", answerIs);
        lines = [
            shapeHint(answer) ? t("hintShape", { shape: shapeHint(answer) }) : length === 1 ? t("hintLength", { n: 1 }) : "",
            answerIs === "word" && w.phonetic && !shown.detail ? t("hintPhonetic", { phonetic: w.phonetic }) : "",
            context ? t("hintContext", { sentence: context }) : "",
            w.word_type ? t("hintWordType", { type: w.word_type }) : "",
        ];
    } else {
        const c = card.character;
        const meaning = c.meaning ?? "";
        const parts = shown.detail ? [] : [c.strokes ? t("strokeCount", { n: c.strokes }) : "", c.radical ? t("hintRadical", { radical: c.radical }) : ""].filter(Boolean);
        lines = [
            parts.join(" · "),
            c.phonetic ? t("hintPhonetic", { phonetic: c.phonetic }) : "",
            shapeHint(meaning) ? t("hintShape", { shape: shapeHint(meaning) }) : "",
        ];
    }
    return [...lines.filter(Boolean), ...fromLesson, t("hintThink")];
}

/** The Hint row above a flashcard (RC-25): the Hint button, then what the hints taken so far say, with `children` (Practice) beside the button and `trailing` (Delete)
 *  at the far end of the same row. Always rendered: a card always has at least two steps. */
export default function HintLadder({ card, level, onHint, shown, children, trailing }: { children?: React.ReactNode; trailing?: React.ReactNode; card: Vocabulary | Calligraphy; level: number; onHint: () => void; shown: Shown }) {
    const t = useTranslations("elements");
    const lines = useHintLines(card, shown);
    const steps = lines.length;     // the best grade stops dropping after the second hint (HINT_CAPS), the ladder goes on
    return (
        <div role="group" aria-label={t("hintButton")} className="flex flex-wrap items-center gap-x-3 gap-y-2">   {/* row 1: Hint, Practice, Delete: never moves. Row 2: what the hints say */}
            <HintButton level={level} steps={steps} onClick={onHint} />
            {children}
            {level > 0 && (
                <ol className="order-last m-0 flex w-full list-none flex-col gap-1 rounded-xl border border-border bg-surface px-3 py-2" aria-live="polite">
                    {lines.slice(0, level).map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm"><Lightbulb size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden /><span>{line}</span></li>
                    ))}
                    <li className="text-xs text-muted list-none">{t("hintCapNote")}</li>
                </ol>
            )}
            {trailing && <div className="ml-auto">{trailing}</div>}
        </div>
    );
}
