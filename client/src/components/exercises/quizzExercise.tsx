"use client";

import { useState, useEffect } from "react";
import { useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";

import Exercise from "@/interface/features/Exercise";
import { updateScoreById } from "@/api/process";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import MissingContentNotice from "./missingContentNotice";

export default function QuizzExercise({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const content = exercise.content as { options: string[]; correct: number[] } | null;
    const text_support = exercise.text_support || "";

    const [selected, setSelected] = useState<number[]>([]);
    const [isCorrect, setIsCorrect] = useState<boolean>(false);
    const [attempts, setAttempts] = useState<number>(0);
    const hasFeedback = isCorrect || attempts > 0;
    const startTimeRef = useRef<number>(performance.now());

    useEffect(() => {
        setSelected([]);
        setIsCorrect(false);
        setAttempts(0);
        startTimeRef.current = performance.now();
    }, [exercise]);

    if (!content) return <MissingContentNotice />;

    const toggleOption = (i: number) => {
        if (isCorrect) return;
        setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const a = [...selected].sort();
        const b = [...content.correct].sort();
        const matches = a.length === b.length && a.every((v, i) => v === b[i]);

        const duration_ms = Math.round(performance.now() - startTimeRef.current);
        if (matches) {
            setIsCorrect(true);
            updateScoreById(exercise.id!, 1, duration_ms, false, attempts + 1).catch(console.error);
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            updateScoreById(exercise.id!, 0, duration_ms, false, newAttempts).catch(console.error);
        }
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
                <div className={`card mt-4 ${isCorrect ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {isCorrect ? (
                        <p>{t("wellDone")}</p>
                    ) : (
                        <p>{`✗ Wrong answer (Attempt ${attempts}). The correct answers were: ${content.correct.map(i => content.options[i]).join(", ")}.`}</p>
                    )}
                </div>
            )}
        </form>
    );
}
