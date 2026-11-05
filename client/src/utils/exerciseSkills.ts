import type Exercise from "@/interface/features/Exercise";

export interface Skips { hear: boolean; speak: boolean }

/** Needs the learner to listen (dictation, or an answering exercise with audio). `reading` never does: its Play button is optional. */
export function needsHearing(ex: Pick<Exercise, "exercise_type" | "audio_files">): boolean {
    return ex.exercise_type === "dictation" || (ex.exercise_type === "answering" && !!ex.audio_files?.length);
}

/** Needs the learner to speak. */
export function needsSpeaking(ex: Pick<Exercise, "exercise_type">): boolean {
    return ex.exercise_type === "speaking" || ex.exercise_type === "conversation";
}

export function isSkipped(ex: Exercise, skips: Skips): boolean {
    return (skips.hear && needsHearing(ex)) || (skips.speak && needsSpeaking(ex));
}

/** Splits into kept and skipped, order preserved. */
export function applySkips<T extends Exercise>(items: T[], skips: Skips): { kept: T[]; skipped: T[] } {
    return { kept: items.filter((i) => !isSkipped(i, skips)), skipped: items.filter((i) => isSkipped(i, skips)) };
}
