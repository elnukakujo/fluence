import { useEffect } from "react";
import type Exercise from "@/interface/features/Exercise";

export type ExerciseRunnerProps = { exercise: Exercise; onFinished?: () => void; gaveUp?: boolean };

/** Calls `onFinished` once, when `finished` turns true (components remount per exercise, so it resets itself). */
export function useFinished(finished: boolean, onFinished?: () => void) {
    useEffect(() => { if (finished) onFinished?.(); }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The solution as readable lines, shown when the learner gives up. Empty when the exercise has no single solution. */
export function solutionLines(ex: Exercise): string[] {
    const c = ex.content as Record<string, any> | undefined;
    switch (ex.exercise_type) {
        case "type_in_the_blank":
        case "select_in_the_blank": return (c?.blanks ?? []).map((b: { answer: string }) => b.answer);
        case "matching": return (c?.pairs ?? []).map((p: [string, string]) => `${p[0]} — ${p[1]}`);
        case "organize": return [ex.answer];
        case "true_false": return c ? [String(c.answer)] : [];
        case "quizz": return c ? c.correct.map((i: number) => c.options[i]) : [];
        case "reading":
        case "dictation": return (c?.lines ?? []).map((l: { text: string }) => l.text);
        default: return ex.answer ? [ex.answer] : [];
    }
}
