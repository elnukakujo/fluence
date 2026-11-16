import type Exercise from "@/interface/features/Exercise";
import { scoreExercise } from "@/api/process";
import { exerciseResults } from "@/utils/skills";

/** Post the finished attempt of an exercise: each linked element is credited from the blank / pair that tests it (`parts`), else at `quality`. */
export function creditExercise(ex: Exercise, quality: number, durationMs: number, hintUsed: boolean, attempt: number, parts?: number[]) {
    return scoreExercise(ex.id!, { results: exerciseResults(ex, quality, parts), attempt, final: true, durationMs, hintUsed }).catch(console.error);
}
