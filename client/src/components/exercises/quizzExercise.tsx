"use client";

import { type ExerciseRunnerProps } from "./exerciseFinish";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";

import { useAttemptScoring } from "./useAttemptScoring";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import MissingContentNotice from "./missingContentNotice";

export default function QuizzExercise({ exercise, onFinished }: Omit<ExerciseRunnerProps, "gaveUp">) {
    const t = useTranslations("exercises");
    const content = exercise.content as { options: string[]; correct: number[] } | null;
    const text_support = exercise.text_support || "";

    const [selected, setSelected] = useState<number[]>([]);
    const { attempts, correct, finished, submit } = useAttemptScoring(exercise, onFinished);
    const hasFeedback = finished;

    if (!content) return <MissingContentNotice />;

    const toggleOption = (i: number) => {
        if (correct) return;
        setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const a = [...selected].sort();
        const b = [...content.correct].sort();
        const matches = a.length === b.length && a.every((v, i) => v === b[i]);

        if (matches) submit(1);
        else submit(0, { final: true }); // a wrong quiz answer is final
    };

    return (
        <form className="card flex flex-col space-y-4">
            <section>
                <h3>{exercise.question}</h3>
            </section>
            {text_support.trim() !== "" && (
                <section>
                    <h3>{t("textSupportColon")}</h3>
                    <Markdown remarkPlugins={[remarkGfm]}>{text_support}</Markdown>
                </section>
            )}
            <ElementMediaCard element={exercise} />

            {!hasFeedback && (
                <section className="index-divider flex flex-col space-y-4">
                    <div className="flex flex-col gap-2">
                        {content.options.map((option, i) => (
                            <button
                                type="button"
                                key={i}
                                onClick={() => toggleOption(i)}
                                className={`chip text-left ${selected.includes(i) ? 'bg-accent text-primary-foreground' : ''}`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="btn btn-primary w-fit"
                        disabled={selected.length === 0}
                    >
                        {t("checkAnswer")}
                    </button>
                </section>
            )}

            {hasFeedback && (
                <div className={`card mt-4 ${correct ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {correct ? (
                        <p>{t("wellDone")}</p>
                    ) : (
                        <p>{`✗ Wrong answer (Attempt ${attempts}). The correct answers were: ${content.correct.map(i => content.options[i]).join(", ")}.`}</p>
                    )}
                </div>
            )}
        </form>
    );
}
