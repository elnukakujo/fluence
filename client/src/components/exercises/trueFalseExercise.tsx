"use client";

import { useFinished, type ExerciseRunnerProps } from "./exerciseFinish";
import { useState, useEffect } from "react";
import { useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";

import Exercise from "@/interface/features/Exercise";
import { updateScoreById } from "@/api/process";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import MissingContentNotice from "./missingContentNotice";

export default function TrueFalseExercise({ exercise, onFinished }: Omit<ExerciseRunnerProps, "gaveUp">){
    const t = useTranslations("exercises");
    const content = exercise.content as { statement: string; answer: boolean } | null;
    const text_support = exercise.text_support || "";

    const [isCorrect, setIsCorrect] = useState<boolean>(false);
    const [attempts, setAttempts] = useState<number>(0);
    const [userAnswer, setUserAnswer] = useState<boolean>(true);
    const hasFeedback = isCorrect || attempts > 0;
    const startTimeRef = useRef<number>(performance.now());
    useFinished(isCorrect || attempts > 0, onFinished);

    useEffect(() => {
        setIsCorrect(false);
        setAttempts(0);
        setUserAnswer(true);
        startTimeRef.current = performance.now();
    }, [exercise]);

    if (!content) return <MissingContentNotice />;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userAnswer === content.answer) {
            setIsCorrect(true);
            const duration_ms = Math.round(performance.now() - startTimeRef.current);
            updateScoreById(exercise.id!, 1, duration_ms, false, attempts + 1).catch(console.error);
        } else {
            const newAttempts = attempts + 1;
            setIsCorrect(false);
            setAttempts(newAttempts);
            const duration_ms = Math.round(performance.now() - startTimeRef.current);
            updateScoreById(exercise.id!, 0, duration_ms, false, newAttempts).catch(console.error);
        };
    };

    return (
        <form className="card flex flex-col space-y-4">
            <section>
                <h3>{content.statement}</h3>
            </section>
            {text_support.trim() !== "" && (
                <section>
                    <h3>{t("textSupport")} </h3>
                    <Markdown remarkPlugins={[remarkGfm]}>{text_support}</Markdown>
                </section>
            )}
            <ElementMediaCard element={exercise}/>
            {!hasFeedback && (
                <section className="index-divider flex flex-col space-y-4">
                    <div className="flex items-center space-x-3">
                        <button
                            type="button"
                            onClick={() => setUserAnswer(true)}
                            className={`chip ${userAnswer === true ? 'bg-accent text-primary-foreground' : ''}`}
                        >
                            {t("true")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setUserAnswer(false)}
                            className={`chip ${userAnswer === false ? 'bg-accent text-primary-foreground' : ''}`}
                        >
                            {t("false")}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="btn btn-primary w-fit"
                        disabled={isCorrect}
                    >
                        {t("checkAnswer")}
                    </button>
                </section>
            )}

            {hasFeedback && (
                <div className={`card mt-4 ${isCorrect ?
                    'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {isCorrect ? t("wellDone") : t("wrongAnswer", { correctAnswer: content.answer ? t("true") : t("false") })}
                </div>
            )}
        </form>
    )
}
