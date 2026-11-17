"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type Exercise from "@/interface/features/Exercise";
import SkipButtons from "./skipButtons";
import { canOverride, overrideAttempt } from "./creditExercise";

/** Footer shared by /ex/practice and the daily review: skip buttons while the exercise runs, a full-width Next once it is finished
 *  (or `last`, the closing action, on the final exercise). */
export default function ExerciseFooter({ exercise, finished, isLast, onGiveUp, onSkip, onNext, last }: {
    exercise: Exercise; finished: boolean; isLast: boolean; onGiveUp: () => void; onSkip: (lacks: "hearing" | "speaking") => void; onNext: () => void; last?: ReactNode;
}) {
    const t = useTranslations("exercises");
    const [disputed, setDisputed] = useState(false);
    if (!finished) return <SkipButtons exercise={exercise} onSkip={onSkip} onGiveUp={onGiveUp} />;
    const iWasRight = !disputed && canOverride(exercise.id!) && (
        <button type="button" className="btn btn-secondary w-full min-h-11" onClick={() => { setDisputed(true); void overrideAttempt(exercise.id!); }}>{t("iWasRight")}</button>
    );
    if (isLast && last) return <>{iWasRight}{last}</>;
    return (
        <div className="flex flex-col gap-2">
            {iWasRight}
            <button type="button" autoFocus className="btn btn-primary w-full min-h-11" onClick={onNext}>{t("nextExercise")}</button>
        </div>
    );
}
