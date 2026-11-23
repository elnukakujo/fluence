"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type Exercise from "@/interface/features/Exercise";
import ActionBar from "@/components/review/ActionBar";
import SkipButtons from "./skipButtons";
import { canOverride, overrideAttempt, subscribeSummary, summaryOf } from "./creditExercise";

/** Footer shared by /ex/practice and the daily review: skip buttons while the exercise runs, a full-width Next once it is finished
 *  (or `last`, the closing action, on the final exercise). */
export default function ExerciseFooter({ exercise, finished, isLast, onGiveUp, onSkip, onNext, last, pinned }: {
    exercise: Exercise; finished: boolean; isLast: boolean; onGiveUp: () => void; onSkip: (lacks: "hearing" | "speaking") => void; onNext: () => void; last?: ReactNode; /** In the review: the finished state sits in the pinned action bar (the last card too: its "See results" is that bar's button). */ pinned?: boolean;
}) {
    const t = useTranslations("exercises");
    const [disputed, setDisputed] = useState(false);
    const result = useSyncExternalStore(subscribeSummary, () => summaryOf(exercise.id!), () => null);     // what the answer did to the scores, in the bar's strip
    if (!finished) return <SkipButtons exercise={exercise} onSkip={onSkip} onGiveUp={onGiveUp} />;
    const iWasRight = !disputed && canOverride(exercise.id!) && (
        <button type="button" className="btn btn-secondary min-h-11" onClick={() => { setDisputed(true); void overrideAttempt(exercise.id!); }}>{t("iWasRight")}</button>
    );
    // "I was right" and the way on share one row, in the pinned bar and out of it.
    if (isLast && last !== undefined) return pinned ? <ActionBar phase="next" result={result}><div className="flex items-center gap-2">{iWasRight}{last}</div></ActionBar> : <div className="flex items-center gap-2">{iWasRight}{last}</div>;
    const next = (
        <div className="flex items-center gap-2">
            {iWasRight}
            <button type="button" autoFocus className={`btn btn-primary min-h-11 ${pinned ? "px-4" : "flex-1"}`} onClick={onNext}>{t("nextExercise")}</button>
        </div>
    );
    return pinned ? <ActionBar phase="next" result={result}>{next}</ActionBar> : next;
}
