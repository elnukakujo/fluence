"use client";

import { useTranslations } from "next-intl";
import { solutionLines } from "./exerciseFinish";
import type Exercise from "@/interface/features/Exercise";

/** The solution of a given-up exercise, announced to screen readers. */
export default function CorrectAnswer({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const lines = solutionLines(exercise);
    if (!lines.length) return null;
    return (
        <section role="status" className="card border-success/30 bg-success/10 text-success">
            <p className="font-medium">{t("correctAnswer")}</p>
            {lines.map((l, i) => <p key={i}>{l}</p>)}
        </section>
    );
}
