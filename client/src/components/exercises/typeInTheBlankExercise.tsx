"use client";

import { evaluateText, updateScoreById } from "@/api/process";
import type Exercise from "@/interface/features/Exercise";
import { useEffect, useState } from "react";
import { useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import { getLevelForScore } from "@/utils/speech_levels";
import { Ring } from 'ldrs/react';
//@ts-ignore
import 'ldrs/react/Ring.css';
import ElementMediaCard from "@/components/elements/elementMediaCard";
import MissingContentNotice from "./missingContentNotice";

export default function TypeInTheBlankExercise({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const content = exercise.content as { segments: string[]; blanks: { options?: string[]; answer: string }[] } | null;
    const text_support = exercise.text_support || "";
    const segments = content?.segments ?? [];
    const blanks = content?.blanks ?? [];
    const correctAnswers = blanks.map(b => b.answer);

    const [filledAnswers, setFilledAnswers] = useState<(string | null)[]>(Array(blanks.length).fill(null));
    const [isCorrect, setIsCorrect] = useState<boolean>(false);
    const [attempts, setAttempts] = useState(0);
    const hasFeedback = isCorrect || attempts > 0;
    const [currentLevel, setCurrentLevel] = useState<{ label: string; description: string, stars: string } | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const startTimeRef = useRef<number>(performance.now());

    useEffect(() => {
        setFilledAnswers(Array(blanks.length).fill(null));
        setIsCorrect(false);
        setAttempts(0);
        setCurrentLevel(null);
        setIsLoading(false);
        setFeedbackMessage(null);
        startTimeRef.current = performance.now();
    }, [exercise]);

    if (!content) return <MissingContentNotice />;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        let answerIndex = 0;
        const userText = segments.reduce((acc, part, i) => {
            if (i === segments.length - 1) return acc + part;
            const nextAnswer = filledAnswers[answerIndex++] ?? "";
            return acc + part + (nextAnswer ?? "").trim();
        }, "");

        evaluateText(exercise.id!, userText).then((result) => {
            setFeedbackMessage(result.feedback);
            setCurrentLevel(getLevelForScore(result.score, "type_in_the_blank"));
            if (result.correct === true) {
                setIsCorrect(true);
                const duration_ms = Math.round(performance.now() - startTimeRef.current);
                updateScoreById(exercise.id!, result.score, duration_ms, false, attempts + 1).catch(console.error);
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                if (newAttempts >= 3) {
                    const duration_ms = Math.round(performance.now() - startTimeRef.current);
                    updateScoreById(exercise.id!, result.score, duration_ms, false, newAttempts).catch(console.error);
                }
            }
            setIsLoading(false);
        }).catch((error) => {
            setFeedbackMessage(null);
            setIsLoading(false);
            console.error("Error evaluating fill-in-the-blank:", error);
        });
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
            return [
                ...renderSegmentText(part, `t-${i}`),
                <AutoWidthInput
                    key={`blank-${idx}`}
                    value={filledAnswers[idx] ?? ''}
                    onChange={(e) => {
                        if (attempts >= 3) return;
                        const val = e.target.value;
                        setFilledAnswers(prev => {
                            const next = [...prev];
                            next[idx] = val;
                            return next;
                        });
                    }}
                    disabled={isCorrect || attempts >= 3}
                    className={`input inline-block mx-1 text-center ${
                        hasFeedback
                        ? isCorrect
                            ? 'border-success text-success'
                            : 'border-danger text-danger'
                        : ''
                    }`}
                />
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

            <div className="index-divider flex flex-row flex-wrap items-center">
                {renderSegments()}
            </div>

            {!isCorrect && attempts < 3 && (
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <Ring
                            size="24"
                            stroke="2"
                            bgOpacity="0"
                            speed="3"
                            color="white"
                        />
                    ) : (
                        <p>{t("checkAnswers")}</p>
                    )}
                </button>
            )}

            {hasFeedback && (
                <div className={`card mt-4 ${isCorrect ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {isCorrect ? (
                        <>
                            <p>{t("wellDone")}</p>
                        </>
                    ) : (
                        <p>{t("someAnswersIncorrect", { attempt: attempts })}</p>
                    )}
                    <p>
                        {feedbackMessage && (
                            <span className="font-medium">{t("feedback")} </span>
                        )}
                        {feedbackMessage}
                    </p>
                    {currentLevel && <p>{t("level")}{currentLevel.label} ({currentLevel.stars})</p>}
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
