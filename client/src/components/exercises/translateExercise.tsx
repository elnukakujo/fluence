"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import { Ring } from 'ldrs/react';
import { useTranslations } from "next-intl";
//@ts-ignore
import 'ldrs/react/Ring.css';
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import Exercise from "@/interface/features/Exercise";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import { updateScoreById, evaluateText } from "@/api/process";
import { getLevelForScore } from "@/utils/speech_levels";
import ElementMediaCard from "@/components/elements/elementMediaCard";

export default function TranslateExercise({ exercise }: {exercise: Exercise}){
    const t = useTranslations("exercises");
    const question = exercise.question || "";
    const answer = exercise.answer || "";
    const text_support = exercise.text_support || "";
    
    const [attempts, setAttempts] = useState<number>(0);
    const [isCorrect, setIsCorrect] = useState<boolean>(false);
    const [userAnswer, setUserAnswer] = useState<string>('');
    const hasFeedback = isCorrect || attempts > 0;

    const [currentLevel, setCurrentLevel] = useState<{ label: string; description: string, stars: string } | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const startTimeRef = useRef<number>(performance.now());

    useEffect(() => {
        setAttempts(0);
        setIsCorrect(false);
        setUserAnswer('');
        startTimeRef.current = performance.now();
    }, [exercise]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        evaluateText(exercise.id!, userAnswer).then((result) => {
            setFeedbackMessage(result.feedback);
            setCurrentLevel(getLevelForScore(result.score, "translate"));
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
            <section>
                <h3>{t("textToTranslate")} </h3>
                <Markdown remarkPlugins={[remarkGfm]}>{question}</Markdown>
            </section>
            {text_support.trim() !== "" && (
                <section>
                    <h3>{t("textSupport")} </h3>
                    <Markdown remarkPlugins={[remarkGfm]}>{text_support}</Markdown>
                </section>
            )}
            <ElementMediaCard element={exercise}/>
            <div className="index-divider" />
            <AutoSizeTextArea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className={`input ${hasFeedback ? (isCorrect ? 'border-success' : 'border-danger') : ''}`}
                placeholder={t("referencePlaceholder")}
                disabled={isCorrect || attempts >= 3}
            />
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

            {hasFeedback && currentLevel && (
                <div className={`card mt-4 ${isCorrect ?
                    'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {isCorrect ? (
                        <>
                            <p>
                                {t("correct")}
                            </p>
                            <p>
                                {t("correctAnswer")}{answer}
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
                            <p className="font-medium">{t("correctAnswerWas")}</p>
                            <p>{answer}</p>
                        </div>
                    )}
                </div>
            )}
        </form>
    )
}