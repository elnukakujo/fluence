import type Exercise from "@/interface/features/Exercise";

/** Needs the learner to listen: any exercise that carries audio (EX-18), whatever its type, and every dictation. `reading` never does: its Play button is optional (the text is on screen). */
export function needsHearing(ex: Pick<Exercise, "exercise_type" | "audio_files">): boolean {
    return ex.exercise_type === "dictation" || (ex.exercise_type !== "reading" && !!ex.audio_files?.length);
}

/** Needs the learner to speak. */
export function needsSpeaking(ex: Pick<Exercise, "exercise_type">): boolean {
    return ex.exercise_type === "speaking" || ex.exercise_type === "conversation";
}
