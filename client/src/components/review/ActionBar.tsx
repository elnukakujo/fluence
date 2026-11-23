"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp } from "lucide-react";

export type ActionResult = { gradeLabel: string; before: number; after: number; levelUp: boolean };

/** The review's pinned bar (RC-27): one slot at the bottom of the screen, whatever the screen size, so the thumb never moves.
 *  Before the card is graded it holds the grading controls (children); afterwards a result strip over a large Next. Enter or Space also moves on. */
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
    return (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface px-4 py-3 md:bottom-0" data-testid="action-bar">
            <div className="mx-auto flex max-w-2xl flex-col gap-2">
                {phase === "next" && (
                    <p className="flex items-center justify-between text-sm" aria-live="polite" data-testid="result-strip">
                        {result ? (
                            <>
                                <span className="font-medium">{result.gradeLabel}</span>
                                <span className="tabular-nums">{Math.round(result.before)} → {Math.round(result.after)}
                                    {result.levelUp && <span className="ml-2 inline-flex items-center gap-1 text-success pulse-once" data-testid="level-up"><ArrowUp size={14} aria-hidden />{t("levelUp")}</span>}
                                </span>
                            </>
                        ) : <span className="sr-only">{t("answerSaved")}</span>}
                    </p>
                )}
                {phase === "next" && !children
                    ? <button type="button" className="btn btn-primary min-h-11 w-full" onClick={onNext} autoFocus>{t("nextButton")}</button>
                    : children}
            </div>
        </div>
    );
}
