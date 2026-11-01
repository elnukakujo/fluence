"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import shuffle from 'lodash/shuffle';
import { useTranslations } from "next-intl";

import { Ring } from 'ldrs/react';
//@ts-ignore
import 'ldrs/react/Ring.css';

import Exercise from "@/interface/features/Exercise";
import { updateScoreById, evaluateText } from "@/api/process";
import { getLevelForScore } from "@/utils/speech_levels";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import MissingContentNotice from "./missingContentNotice";

export default function OrganizeExercise({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const content = exercise.content as { items: string[]; answer_order: number[] } | null;
    const items = content?.items ?? [];
    const correctOrder = (content?.answer_order ?? []).map(i => items[i]);
    const answer = correctOrder.join(' ');
    const text_support = exercise.text_support || "";

    const [attempts, setAttempts] = useState<number>(0);
    const [isCorrect, setIsCorrect] = useState<boolean>(false);
    const hasFeedback = isCorrect || attempts > 0;

    const [wordsToOrganize, setWordsToOrganize] = useState<string[]>([]);

    const [userAnswer, setUserAnswer] = useState<Array<{ word: string; sourceIndex: number }>>([]);

    const [currentLevel, setCurrentLevel] = useState<{ label: string; description: string, stars: string } | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const startTimeRef = useRef<number>(performance.now());

    useEffect(() => {
        setWordsToOrganize(shuffle(items));
        setAttempts(0);
        setIsCorrect(false);
        setUserAnswer([]);
        setFeedbackMessage(null);
        startTimeRef.current = performance.now();
    }, [exercise]);

    if (!content) return <MissingContentNotice />;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        evaluateText(exercise.id!, userAnswer.map(item => item.word).join(' ')).then((result) => {
            setFeedbackMessage(result.feedback);
            setCurrentLevel(getLevelForScore(result.score, "organize"));
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
            console.error("Error evaluating translation:", error);
        });
    };

    return (
        <form className="card flex flex-col space-y-4" onSubmit={handleSubmit}>
            {(!isCorrect && attempts < 3) && (
                <>
                    {text_support.trim() !== "" && (
                        <section>
                            <h3>{t("textSupport")} </h3>
                            <Markdown remarkPlugins={[remarkGfm]}>{text_support}</Markdown>
                        </section>
                    )}
                    <ElementMediaCard element={exercise}/>
                    <section className="index-divider">
                        <h3>{t("wordsToOrganize")}</h3>
                        <div className="flex flex-wrap gap-2">
                            {wordsToOrganize.map((word, index) => {
                                const isSelected = userAnswer.some(item => item.sourceIndex === index);
                                return (
                                    <button
                                        type="button"
                                        key={index}
                                        onClick={() => {
                                            if (isSelected) {
                                                setUserAnswer(prev => prev.filter(item => item.sourceIndex !== index));
                                            } else {
                                                setUserAnswer(prev => [...prev, { word, sourceIndex: index }]);
                                            }
                                        }}
                                        className={`chip transition-transform duration-350 ${isSelected ? 'opacity-40' : ''}`}
                                        aria-pressed={isSelected}
                                    >
                                        {word.trim()}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                    <section>
                        <h3>{t("yourAnswer")} </h3>
                        <div className="flex flex-wrap gap-2">
                            {userAnswer.map((item, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    className="chip bg-accent text-primary-foreground"
                                    onClick={() => setUserAnswer(prev => prev.filter((_, i) => i !== index))}
                                >
                                    {item.word}
                                </button>
                            ))}
                        </div>
                    </section>
                    { !isCorrect && attempts < 3 ? (
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isCorrect || attempts >= 3 || isLoading}
                        >
                            {isLoading ? (
                                <Ring
                                    size="24"
                                    stroke="2"
                                    bgOpacity="0"
                                    speed="3"
                                    color="white"
                                />
                            )
                            : (
                                <p>{t("checkAnswers")}</p>
                            )}
                        </button>
                    ) : null}
                </>
            )}
            {hasFeedback && currentLevel && (
                <div className={`card mt-4 ${isCorrect ?
                    'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {isCorrect ? (
                        <>
                            <p>
                                {t("correct")}
                            </p>
                        </>
                    ) : <p>{t("someAnswersIncorrect", { attempt: attempts })}</p>}
                    <p>
                        {feedbackMessage && (
                            <span className="font-medium">{t("feedback")} </span>
                        )}
                        {feedbackMessage}
                    </p>
                    <p>
                        {t("level")}{currentLevel!.label} ({currentLevel!.stars})
                    </p>
                    {attempts >= 3 && !isCorrect && (
                        <div className="mt-2">
                            <p className="font-medium">{t("correctAnswer")} {answer}</p>
                        </div>
                    )}
                </div>
            )}
        </form>
    );
}
