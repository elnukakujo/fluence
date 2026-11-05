"use client";

import { useTranslations } from "next-intl";
import { EarOff, MicOff } from "lucide-react";
import type Exercise from "@/interface/features/Exercise";
import { needsHearing, needsSpeaking } from "@/utils/exerciseSkills";

/** "I can't hear" on exercises that play audio, "I can't speak" on exercises that record you: each skips this exercise, unscored. Nothing for other exercises. */
export default function SkipButtons({ exercise, onSkip }: { exercise: Exercise; onSkip: () => void }) {
    const t = useTranslations("exercises");
    const hear = needsHearing(exercise);
    const speak = needsSpeaking(exercise);
    if (!hear && !speak) return null;
    const Icon = hear ? EarOff : MicOff;
    return (
        <button type="button" className="btn btn-secondary inline-flex items-center gap-2 min-h-11" title={t("skipThisExercise")} onClick={onSkip}>
            <Icon size={16} aria-hidden />{hear ? t("cantHear") : t("cantSpeak")}
        </button>
    );
}
