"use client";

import { type ExerciseRunnerProps } from "./exerciseFinish";
import { useAttemptScoring } from "./useAttemptScoring";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import { evaluateText } from "@/api/process";
import { getExerciseLevel } from "@/utils/speech_levels";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import { CheckButton } from "./evaluatedFrame";
import FeedbackNote from "./feedbackNote";

export default function TranslateExercise({ exercise, onFinished }: Omit<ExerciseRunnerProps, "gaveUp">){
    const t = useTranslations("exercises");
    const question = exercise.question || "";
    const answer = exercise.answer || "";
    const text_support = exercise.text_support || "";
    
    const [userAnswer, setUserAnswer] = useState<string>('');
    const { attempts, correct, submit, miss } = useAttemptScoring(exercise, onFinished);
    const hasFeedback = correct || attempts > 0;

    const [currentLevel, setCurrentLevel] = useState<{ label: string; description: string, stars: string } | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    useEffect(() => {
        setUserAnswer('');
    }, [exercise]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        evaluateText(exercise.id!, userAnswer).then((result) => {
            setFeedbackMessage(result.feedback);
            setCurrentLevel(getExerciseLevel("translate", result.score, t));
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
                className={`input ${hasFeedback ? (correct ? 'border-success' : 'border-danger') : ''}`}
                placeholder={t("referencePlaceholder")}
                disabled={correct || attempts >= 3}
            />
            { !correct && attempts < 3 ? (
                <CheckButton label={t("checkAnswers")} loading={isLoading} />
            ) : null}

            {hasFeedback && currentLevel && (
                <FeedbackNote verdict={correct ? "correct" : "wrong"} headline={correct ? t("correct") : t("someAnswersIncorrect", { attempt: attempts })} message={feedbackMessage} level={currentLevel}
                    reveal={correct ? { label: t("correctAnswer"), value: answer } : attempts >= 3 ? { label: t("correctAnswerWas"), value: answer } : null} />
            )}
        </form>
    )
}