"use client";

import { type ExerciseRunnerProps } from "./exerciseFinish";
import { useAttemptScoring } from "./useAttemptScoring";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Ring } from "ldrs/react";
import { useTranslations } from "next-intl";
//@ts-ignore
import 'ldrs/react/Ring.css';

import { evaluateText } from "@/api/process";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import { getExerciseLevel } from "@/utils/speech_levels";
import ElementMediaCard from "@/components/elements/elementMediaCard";

export default function EssayExercise({ exercise, onFinished }: Omit<ExerciseRunnerProps, "gaveUp">) {
    const t = useTranslations("exercises");
    const question = exercise.question || "";
    const answer = exercise.answer || "";
    const text_support = exercise.text_support || "";
    
    const [userAnswer, setUserAnswer] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentLevel, setCurrentLevel] = useState<{ label: string; description: string, stars: string } | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    const { attempts, correct, submit, miss } = useAttemptScoring(exercise, onFinished);
    useEffect(() => {
        setUserAnswer('');
        setIsLoading(false);
        setCurrentLevel(null);
        setFeedbackMessage(null);
    }, [exercise]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        evaluateText(exercise.id!, userAnswer).then(result => {
            setFeedbackMessage(result.feedback);
            setCurrentLevel(getExerciseLevel("essay", result.score, t));
            if (result.correct === true) {
                submit(result.score, { final: true, correct: true });
            } else if (attempts >= 2) {
                submit(result.score, { final: true, correct: false }); // the third miss
            } else {
                miss();
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
                <h3>{t("question")}</h3>
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
                className="input"
                placeholder={t("referencePlaceholder")}
                disabled={attempts >= 3 || correct || isLoading}
            />
            {(!correct && attempts < 3) && (
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={attempts >= 3 || correct || isLoading}
                >
                    {
                        !isLoading
                        ?<p>{t("showCorrection")}</p>
                        :(
                            <Ring
                                size="24"
                                stroke="2"
                                bgOpacity="0"
                                speed="3"
                                color="white"
                            />
                        )
                    }
                </button>
            )}

            {(correct || attempts > 0) && (
                <div className={`card mt-4 ${correct ?
                    'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {correct ? (
                        <>
                            <p>
                                {t("correct")}
                            </p>
                            {answer && <p>
                                {t("correctAnswer")}{answer}
                            </p>}
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
                    {attempts >= 3 && !correct && answer && (
                        <div className="mt-2">
                            <p className="font-medium">{t("providedExampleAnswer")} {answer}</p>
                        </div>
                    )}
                </div>
            )}
        </form>
    );
}