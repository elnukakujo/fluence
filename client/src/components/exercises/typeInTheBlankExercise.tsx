"use client";

import { type ExerciseRunnerProps } from "./exerciseFinish";
import { evaluateText } from "@/api/process";
import { useAttemptScoring } from "./useAttemptScoring";
import { blankQuality } from "@/utils/typedAnswer";
import type Exercise from "@/interface/features/Exercise";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import { getExerciseLevel } from "@/utils/speech_levels";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import MissingContentNotice from "./missingContentNotice";
import { CheckButton, FeedbackPanel } from "./evaluatedFrame";

export default function TypeInTheBlankExercise({ exercise, onFinished }: Omit<ExerciseRunnerProps, "gaveUp">) {
    const t = useTranslations("exercises");
    const content = exercise.content as { segments: string[]; blanks: { options?: string[]; answer: string }[] } | null;
    const text_support = exercise.text_support || "";
    const segments = content?.segments ?? [];
    const blanks = content?.blanks ?? [];
    const correctAnswers = blanks.map(b => b.answer);

    const [filledAnswers, setFilledAnswers] = useState<(string | null)[]>(Array(blanks.length).fill(null));
    const { attempts, correct, submit, miss } = useAttemptScoring(exercise, onFinished);
    const hasFeedback = correct || attempts > 0;
    const [currentLevel, setCurrentLevel] = useState<{ label: string; description: string, stars: string } | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    useEffect(() => {
        setFilledAnswers(Array(blanks.length).fill(null));
        setCurrentLevel(null);
        setIsLoading(false);
        setFeedbackMessage(null);
    }, [exercise]);

    if (!content) return <MissingContentNotice />;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        // Only what the learner typed in the blanks is graded, the same shape as the stored answer ("a, b").
        const userText = blanks.map((_, i) => (filledAnswers[i] ?? "").trim()).join(", ");

        evaluateText(exercise.id!, userText).then((result) => {
            setFeedbackMessage(result.feedback);
            setCurrentLevel(getExerciseLevel("type_in_the_blank", result.score, t));
            const parts = (result.blanks as number[] | undefined)?.map(blankQuality);   // each blank credits the element it tests
            if (result.correct === true) {
                submit(result.score, { final: true, correct: true, parts });
            } else if (attempts >= 2) {
                submit(result.score, { final: true, correct: false, parts }); // the third miss
            } else {
                miss();
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
                    disabled={correct || attempts >= 3}
                    className={`input inline-block mx-1 text-center ${
                        hasFeedback
                        ? correct
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

            {!correct && attempts < 3 && (
                <CheckButton label={t("checkAnswers")} loading={isLoading} />
            )}

            {hasFeedback && (
                <FeedbackPanel correct={correct}>
                    {correct ? (
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
                    {attempts >= 3 && !correct && (
                        <div className="mt-2">
                            <p className="font-medium">{t("correctAnswersLabel")}</p>
                            <div className="flex gap-2 mt-1">
                                {correctAnswers.map((ans, i) => (
                                <span key={i} className="badge">{ans}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </FeedbackPanel>
            )}
        </form>
    );
}
