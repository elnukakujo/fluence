"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, ArrowUp } from "lucide-react";
import { FormActions } from "@/components/elements/formParts";

export type ActionResult = { before: number; after: number; level: string; levelUp: boolean; capped?: boolean };

/** The review's action bar (RC-27): the same bar as the element forms' Save (`FormActions`), stuck to the bottom of the screen so the thumb never moves.
 *  Before the card is graded it holds the grading controls (children); afterwards one row: what the answer did on the left, Next on the right. Enter or Space also moves on. */
export default function ActionBar({ phase, onNext, result, children, nextLabel }: { phase: "grade" | "next"; onNext?: () => void; result?: ActionResult | null; children?: ReactNode; nextLabel?: string }) {
    const t = useTranslations("elements");
    const tLevel = useTranslations("home.level");
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
    const delta = result ? Math.round(result.after) - Math.round(result.before) : 0;
    const strip = (
        <span aria-live="polite" data-testid="result-strip" className="flex flex-col">
            {result ? (
                <>
                    <span className={`font-medium ${result.capped ? "text-foreground" : delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-foreground"}`}>
                        {result.capped ? t("dailyLimit") : delta > 0 ? t("resultGain", { n: delta }) : delta < 0 ? t("resultLoss", { n: -delta }) : t("resultSame")}
                        {result.levelUp && <span className="pulse-once ml-2 inline-flex items-center gap-1 text-success" data-testid="level-up"><ArrowUp size={14} aria-hidden />{t("levelUp")}</span>}
                    </span>
                    <span className="text-xs tabular-nums">{t("resultScore", { before: Math.round(result.before), after: Math.round(result.after), level: tLevel(result.level) })}</span>
                </>
            ) : <span className="sr-only">{t("answerSaved")}</span>}
        </span>
    );
    return (
        <FormActions note={strip} testId="action-bar">
            {children ?? <button type="button" className="btn btn-primary min-h-11 inline-flex items-center gap-2 px-6" onClick={onNext} autoFocus>{nextLabel ?? t("nextButton")}<ArrowRight size={16} aria-hidden /></button>}
        </FormActions>
    );
}
