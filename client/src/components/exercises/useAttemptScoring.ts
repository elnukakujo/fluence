import { useEffect, useRef, useState } from "react";
import type Exercise from "@/interface/features/Exercise";
import { updateScoreById } from "@/api/process";
import { useFinished } from "./exerciseFinish";

export type AttemptScoring = {
    attempts: number;
    finished: boolean;
    correct: boolean;
    /** Post `score` for this attempt and advance `attempts`. Marks finished when `score === 1` or `final`. */
    submit(score: number, opts?: { hintUsed?: boolean; final?: boolean }): void;
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

    const submit = (score: number, opts?: { hintUsed?: boolean; final?: boolean }) => {
        if (finished) return; // double-submit after finishing posts nothing
        const attempt = attempts + 1;
        setAttempts(attempt);
        updateScoreById(exercise.id!, score, Math.round(performance.now() - startRef.current), opts?.hintUsed ?? false, attempt).catch(console.error);
        if (score === 1 || opts?.final) {
            setCorrect(score === 1);
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
