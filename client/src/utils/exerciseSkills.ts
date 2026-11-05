import type Exercise from "@/interface/features/Exercise";

/** Needs the learner to listen (dictation, or an answering exercise with audio). `reading` never does: its Play button is optional. */
export function needsHearing(ex: Pick<Exercise, "exercise_type" | "audio_files">): boolean {
    return ex.exercise_type === "dictation" || (ex.exercise_type === "answering" && !!ex.audio_files?.length);
}

/** Needs the learner to speak. */
export function needsSpeaking(ex: Pick<Exercise, "exercise_type">): boolean {
    return ex.exercise_type === "speaking" || ex.exercise_type === "conversation";
}
