"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type Exercise from "@/interface/features/Exercise";
import SkipButtons from "./skipButtons";

/** Footer shared by /ex/practice and the daily review: skip buttons while the exercise runs, a full-width Next once it is finished
 *  (or `last`, the closing action, on the final exercise). */
export default function ExerciseFooter({ exercise, finished, isLast, onGiveUp, onSkip, onNext, last }: {
    exercise: Exercise; finished: boolean; isLast: boolean; onGiveUp: () => void; onSkip: (lacks: "hearing" | "speaking") => void; onNext: () => void; last?: ReactNode;
}) {
    const t = useTranslations("exercises");
    if (!finished) return <SkipButtons exercise={exercise} onSkip={onSkip} onGiveUp={onGiveUp} />;
    if (isLast && last) return <>{last}</>;
    return <button type="button" autoFocus className="btn btn-primary w-full min-h-11" onClick={onNext}>{t("nextExercise")}</button>;
}
