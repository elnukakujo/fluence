"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, ArrowUp } from "lucide-react";
import { FormActions } from "@/components/elements/formParts";

export type ActionResult = { gradeLabel: string; before: number; after: number; levelUp: boolean; capped?: boolean };

/** The review's action bar (RC-27): the same bar as the element forms' Save (`FormActions`), stuck to the bottom of the screen so the thumb never moves.
 *  Before the card is graded it holds the grading controls (children); afterwards one row: what the answer did on the left, Next on the right. Enter or Space also moves on. */
export default function ActionBar({ phase, onNext, result, children }: { phase: "grade" | "next"; onNext?: () => void; result?: ActionResult | null; children?: ReactNode }) {
    const t = useTranslations("elements");
    useEffect(() => {
        if (phase !== "next" || !onNext) return;
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (e.key !== "Enter" && e.key !== " ") return;
            if (e.ctrlKey || e.metaKey || e.altKey || el?.closest?.("input, textarea, select, button, a, [contenteditable]")) return;   // a focused control keeps its own Enter / Space
            e.preventDefault();
            onNext();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [phase, onNext]);
    if (phase === "grade") return <FormActions wide testId="action-bar">{children}</FormActions>;
    const strip = (
        <span aria-live="polite" data-testid="result-strip" className="flex flex-wrap items-center gap-x-2">
            {result ? (
                <>
                    <b className="text-foreground">{result.gradeLabel}</b>
                    {result.capped
                        ? <span>{t("dailyLimit")}</span>
                        : <span className="tabular-nums">{Math.round(result.before)} → {Math.round(result.after)}</span>}
                    {result.levelUp && <span className="pulse-once inline-flex items-center gap-1 text-success" data-testid="level-up"><ArrowUp size={14} aria-hidden />{t("levelUp")}</span>}
                </>
            ) : <span className="sr-only">{t("answerSaved")}</span>}
        </span>
    );
    return (
        <FormActions note={strip} testId="action-bar">
            {children ?? <button type="button" className="btn btn-primary min-h-11 inline-flex items-center gap-2 px-6" onClick={onNext} autoFocus>{t("nextButton")}<ArrowRight size={16} aria-hidden /></button>}
        </FormActions>
    );
}
