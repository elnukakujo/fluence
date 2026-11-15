"use client";

import { type ExerciseRunnerProps } from "./exerciseFinish";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";

import { useAttemptScoring } from "./useAttemptScoring";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import MissingContentNotice from "./missingContentNotice";

export default function TrueFalseExercise({ exercise, onFinished }: Omit<ExerciseRunnerProps, "gaveUp">){
    const t = useTranslations("exercises");
    const content = exercise.content as { statement: string; answer: boolean } | null;
    const text_support = exercise.text_support || "";

    const [userAnswer, setUserAnswer] = useState<boolean>(true);
    const { correct, finished, submit } = useAttemptScoring(exercise, onFinished);
    const hasFeedback = finished;

    if (!content) return <MissingContentNotice />;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userAnswer === content.answer) submit(1);
        else submit(0, { final: true }); // a wrong true/false is final
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
                        disabled={correct}
                    >
                        {t("checkAnswer")}
                    </button>
                </section>
            )}

            {hasFeedback && (
                <div className={`card mt-4 ${correct ?
                    'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {correct ? t("wellDone") : t("wrongAnswer", { correctAnswer: content.answer ? t("true") : t("false") })}
                </div>
            )}
        </form>
    )
}
