import { useEffect, useRef, useState } from "react";
import type Exercise from "@/interface/features/Exercise";
import { creditExercise } from "./creditExercise";
import { useFinished } from "./exerciseFinish";

export type AttemptScoring = {
    attempts: number;
    finished: boolean;
    correct: boolean;
    /** Advance `attempts`; when this attempt finishes the exercise (`score === 1` or `final`) credit the linked elements, once (EX-D2: only the final attempt counts).
     *  `correct` overrides the `score === 1` default (for evaluated runners whose score is 0..1); `parts` = the quality of each blank / pair, so each credits its own element. */
    submit(score: number, opts?: { hintUsed?: boolean; final?: boolean; correct?: boolean; parts?: number[] }): void;
    /** Advance `attempts` without posting (a miss that is not yet final). */
    miss(): void;
    /** New start time, attempts 0 (called automatically on exercise change). */
    reset(): void;
};

/** Owns the attempt counter, start-time ref, score post and finish signal shared by the exercise runners. */
export function useAttemptScoring(exercise: Exercise, onFinished?: () => void): AttemptScoring {
    const [attempts, setAttempts] = useState(0);
    const [finished, setFinished] = useState(false);
    const [correct, setCorrect] = useState(false);
    const startRef = useRef(performance.now());

    useFinished(finished, onFinished);

    const submit = (score: number, opts?: { hintUsed?: boolean; final?: boolean; correct?: boolean; parts?: number[] }) => {
        if (finished) return; // double-submit after finishing posts nothing
        const attempt = attempts + 1;
        setAttempts(attempt);
        if (score === 1 || opts?.final) {
            creditExercise(exercise, score, Math.round(performance.now() - startRef.current), opts?.hintUsed ?? false, attempt, opts?.parts);
            setCorrect(opts?.correct ?? score === 1);
            setFinished(true);
        }
    };

    const miss = () => {
        if (finished) return;
        setAttempts((a) => a + 1);
    };

    const reset = () => {
        setAttempts(0);
        setFinished(false);
        setCorrect(false);
        startRef.current = performance.now();
    };

    useEffect(() => {
        reset();
    }, [exercise]);

    return { attempts, finished, correct, submit, miss, reset };
}
