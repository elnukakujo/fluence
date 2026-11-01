"use client";

import { updateScoreById } from "@/api/process";
import type Exercise from "@/interface/features/Exercise";
import { useEffect, useState } from "react";
import { useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import shuffle from 'lodash/shuffle';
import ElementMediaCard from "@/components/elements/elementMediaCard";
import MissingContentNotice from "./missingContentNotice";

export default function SelectInTheBlankExercise({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const content = exercise.content as { segments: string[]; blanks: { options?: string[]; answer: string }[] } | null;
    const text_support = exercise.text_support || "";
    const segments = content?.segments ?? [];
    const blanks = content?.blanks ?? [];
    const correctAnswers = blanks.map(b => b.answer);
    // Word bank: union of all options across blanks, falling back to the correct answers
    const allOptions = blanks.some(b => b.options && b.options.length > 0)
        ? blanks.flatMap(b => b.options ?? [b.answer])
        : correctAnswers;

    const [wordBank, setWordBank] = useState<string[]>([]);
    const [filledAnswers, setFilledAnswers] = useState<(string | null)[]>(Array(blanks.length).fill(null));
    const [isCorrect, setIsCorrect] = useState<boolean>(false);
    const [attempts, setAttempts] = useState(0);
    const startTimeRef = useRef<number>(performance.now());

    useEffect(() => {
        setWordBank(shuffle(allOptions));
        setFilledAnswers(Array(blanks.length).fill(null));
        setIsCorrect(false);
        setAttempts(0);
        startTimeRef.current = performance.now();
    }, [exercise]);

    if (!content) return <MissingContentNotice />;

    // Next unfilled blank index
    const nextBlank = filledAnswers.findIndex(a => a === null);

    const handleWordClick = (word: string, wordIdx: number) => {
        if (attempts >= 3) return; // No more attempts allowed
        if (nextBlank === -1) return;
        setFilledAnswers(prev => {
            const next = [...prev];
            next[nextBlank] = word;
            return next;
        });
        setWordBank(prev => prev.filter((_, i) => i !== wordIdx));
    };

    const handleBlankClick = (blankIdx: number) => {
        if (attempts >= 3) return; // No more attempts allowed
        if (isCorrect) return;
        const word = filledAnswers[blankIdx];
        if (!word) return;
        setFilledAnswers(prev => {
            const next = [...prev];
            next[blankIdx] = null;
            return next;
        });
        setWordBank(prev => [...prev, word]);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (filledAnswers.every((ans, idx) => ans === correctAnswers[idx])) {
            setIsCorrect(true);
            const duration_ms = Math.round(performance.now() - startTimeRef.current);
            updateScoreById(exercise.id!, 1, duration_ms, false, attempts + 1).catch(console.error);
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            if (attempts >= 2) {
                const duration_ms = Math.round(performance.now() - startTimeRef.current);
                updateScoreById(exercise.id!, 0, duration_ms, false, newAttempts).catch(console.error);
            }
        }
    };

    const renderSegmentText = (part: string, key: string) => {
        return part.split("\n").flatMap((piece, j) => j === 0
            ? [<span key={`${key}-${j}`}>{piece}</span>]
            : [<hr key={`${key}-${j}-hr`} className="index-divider w-full my-2" />, <span key={`${key}-${j}`}>{piece}</span>]
        );
    };

    const renderSegments = () => {
        return segments.flatMap((part, i) => {
            if (i === segments.length - 1) return renderSegmentText(part, `t-${i}`);
            const idx = i;
            const filled = filledAnswers[idx];
            return [
                ...renderSegmentText(part, `t-${i}`),
                <button
                    type="button"
                    key={`blank-${idx}`}
                    onClick={() => handleBlankClick(idx)}
                    className={`inline-block min-w-12 mx-1 px-2 border-b-2 text-center ${isCorrect
                        ? 'border-success text-success'
                        : 'border-border'
                    } ${filled ? 'cursor-pointer' : 'cursor-default'}`}
                >
                    {filled ?? '    '}
                </button>
            ];
        });
    };

    return (
        <form className="card flex flex-col space-y-4" onSubmit={handleSubmit}>
            {text_support.trim() !== "" && (
                <section>
                    <h3>{t("textSupportColon")}</h3>
                    <Markdown remarkPlugins={[remarkGfm]}>{text_support}</Markdown>
                </section>
            )}
            <ElementMediaCard element={exercise}/>

            {wordBank && <section className="index-divider">
                <h3>{t("wordBank")}</h3>
                <div className="flex flex-wrap gap-2">
                    {wordBank.map((word, i) => (
                        <button
                            type="button"
                            key={i}
                            onClick={() => handleWordClick(word, i)}
                            className="chip"
                        >
                            {word}
                        </button>
                    ))}
                </div>
            </section>}

            <div className="flex flex-col space-y-2">
                {renderSegments()}
            </div>

            {!isCorrect && attempts < 3 && (
                <button
                    type="submit"
                    className="btn btn-primary"
                >
                    <p>{t("checkAnswers")}</p>
                </button>
            )}

            {attempts > 0 && (
                <div className={`card mt-4 ${isCorrect ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {isCorrect ? (
                        <>
                            <p>{t("wellDone")}</p>
                            <p>{t("correctAnswers")}</p>
                            <div className="flex flex-row gap-2">
                                {correctAnswers.map((ans, i) => (
                                    <span key={i} className="badge">{ans}</span>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p>{t("someAnswersIncorrect", { attempt: attempts })}</p>
                    )}
                    {attempts >= 3 && !isCorrect && (
                        <div className="mt-2">
                            <p className="font-medium">{t("correctAnswers")}</p>
                            <div className="flex gap-2 mt-1">
                                {correctAnswers.map((ans, i) => (
                                    <span key={i} className="badge">{ans}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </form>
    );
}
