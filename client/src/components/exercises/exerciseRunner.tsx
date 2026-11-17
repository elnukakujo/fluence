"use client";

import type { ExerciseRunnerProps } from "./exerciseFinish";
import CorrectAnswer from "./correctAnswer";
import { exerciseTypeInfo } from "./exerciseTypes";

/** Renders a single exercise with its interactive component, by type. */
export default function ExerciseRunner({ exercise, onFinished, gaveUp = false }: ExerciseRunnerProps) {
    const body = render(exercise, onFinished);
    if (!gaveUp) return body;
    // gave up: inputs locked (a disabled fieldset disables everything inside), solution shown
    return <><fieldset disabled className="contents">{body}</fieldset><CorrectAnswer exercise={exercise} /></>;
}

function render(exercise: ExerciseRunnerProps["exercise"], onFinished?: () => void) {
    const info = exerciseTypeInfo(exercise.exercise_type);
    if (!info) return null;
    const Runner = info.Runner;
    return <Runner exercise={exercise} onFinished={onFinished} />;
}
