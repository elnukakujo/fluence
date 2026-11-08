"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { updateScoreById } from "@/api/process";
import { CircleHelp, EarOff, MicOff } from "lucide-react";
import type Exercise from "@/interface/features/Exercise";
import { needsHearing, needsSpeaking } from "@/utils/exerciseSkills";

/** "I don't know" on every exercise: records a 0 score then moves on (counted, not skipped). Only for review and practice, never the single-exercise page.
 *  "I can't hear" on exercises that play audio, "I can't speak" on exercises that record you: each skips this exercise, unscored. Nothing for other exercises. */
export default function SkipButtons({ exercise, onSkip, onNext }: { exercise: Exercise; onSkip: () => void; onNext: () => void }) {
    const t = useTranslations("exercises");
    const hear = needsHearing(exercise);
    const speak = needsSpeaking(exercise);
    const start = useRef(performance.now());
    const Icon = hear ? EarOff : MicOff;
    const dontKnow = () => {
        updateScoreById(exercise.id!, 0, Math.round(performance.now() - start.current), false, 1).catch(console.error);
        onNext();
    };
    return (
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-secondary inline-flex items-center gap-2 min-h-11" onClick={dontKnow}>
                <CircleHelp size={16} aria-hidden />{t("dontKnow")}
            </button>
            {(hear || speak) && (
                <button type="button" className="btn btn-secondary inline-flex items-center gap-2 min-h-11" title={t("skipThisExercise")} onClick={onSkip}>
                    <Icon size={16} aria-hidden />{hear ? t("cantHear") : t("cantSpeak")}
                </button>
            )}
        </div>
    );
}
