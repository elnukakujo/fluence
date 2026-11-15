import { STUDY } from "@/shared/studyConstants";

// Five star tiers, language-neutral (labels/descriptions live in i18n: exercises.levels.<type>.<n>).
const STARS = ["☆☆☆☆☆", "★☆☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"];
const THRESHOLDS = STUDY.exerciseLevelThresholds as Record<string, number[]>;

type Translator = (key: string) => string;

export type ExerciseLevel = { label: string; description: string; stars: string };

/** The star tier for a scored answer. Thresholds come from shared/study-constants.json; text from i18n. */
export function getExerciseLevel(type: string, score: number, t: Translator): ExerciseLevel {
    const thresholds = THRESHOLDS[type] ?? THRESHOLDS.translate;
    let n = 0;
    for (let i = 0; i < thresholds.length; i++) {
        if (score >= thresholds[i]) n = i;
    }
    return {
        label: t(`levels.${type}.${n}.label`),
        description: t(`levels.${type}.${n}.description`),
        stars: STARS[n],
    };
}

