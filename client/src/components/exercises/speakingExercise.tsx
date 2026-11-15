"use client";

import { type ExerciseRunnerProps } from "./exerciseFinish";
import { useEffect, useState, useCallback } from "react";
import { useAttemptScoring } from "./useAttemptScoring";
import { useTranslations } from "next-intl";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { evaluateSpeech } from "@/api/process";
import dynamic from 'next/dynamic';
import { getExerciseLevel } from "@/utils/speech_levels";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import { CheckButton, FeedbackPanel } from "./evaluatedFrame";
const AudioRecorder = dynamic(() => import('@/components/media/audioRecorder'), { ssr: false });

export default function SpeakingExercise({ exercise, onFinished }: Omit<ExerciseRunnerProps, "gaveUp">) {
    const t = useTranslations("exercises");
    const question = exercise.question || "";
    const text_support = exercise.text_support || "";

    const { attempts, correct, submit, miss } = useAttemptScoring(exercise, onFinished);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentLevel, setCurrentLevel] = useState<{ label: string; description: string } | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const hasFeedback = correct || attempts > 0;

    // Lifted state from AudioRecorder via onStatusChange
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [resetKey, setResetKey] = useState<number>(0); // remounts AudioRecorder on exercise change
    const [showExample, setShowExample] = useState<boolean>(false);

    const hasRecording = !!audioUrl;

    // Reset everything when the exercise changes
    useEffect(() => {
        setCurrentLevel(null);
        setAudioUrl(null);
        setFeedbackMessage(null);
        setResetKey((k) => k + 1); // remount AudioRecorder to clear its state
    }, [exercise]);

    // AudioRecorder calls this after a successful upload, giving us the server URL
    const handleUploadSuccess = useCallback((response: unknown) => {
        const res = response as { url?: string; file_url?: string };
        setAudioUrl(res.url ?? res.file_url ?? null);
    }, []);

    const handleSubmit = async () => {
        if (!audioUrl) return;
        setIsLoading(true);

        try {
            const result = await evaluateSpeech(String(exercise.id), audioUrl, 0);
            setFeedbackMessage(result.feedback);
            setCurrentLevel(getExerciseLevel("speaking", result.score, t));

            if (result.correct) {
                submit(1, { correct: true });
            } else if (attempts >= 2) {
                submit(0, { final: true }); // the third miss
            } else {
                miss();
            }

        } catch (error) {
            setFeedbackMessage(null);
            console.error("Error evaluating speaking:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card flex flex-col space-y-4">
            <h3>{question}</h3>

            {text_support.trim() !== "" && (
                <section>
                    <h3>{t("textSupport")} </h3>
                    <Markdown remarkPlugins={[remarkGfm]}>{text_support}</Markdown>
                </section>
            )}

            <ElementMediaCard element={exercise}/>

            {!correct && attempts < 3 && (
                <section className="index-divider flex flex-col space-y-4">
                    <div className="flex flex-row space-x-2">
                        <button
                            type="button"
                            onClick={() => setShowExample((prev) => !prev)}
                            className="btn btn-secondary"
                        >
                            {showExample ? t("hideExample") : t("showExample")}
                        </button>
                        <AudioRecorder
                            key={resetKey}
                            onUploadSuccess={handleUploadSuccess}
                            onUploadError={console.error}
                        />
                    </div>
                    <CheckButton label={t("checkAnswer")} loading={isLoading} disabled={!hasRecording} type="button" onClick={handleSubmit} />
                </section>
            )}

            {hasFeedback && currentLevel && (
                <FeedbackPanel correct={correct}>
                    <h3>{currentLevel.label}</h3>
                    <p className="italic">`&quot;`{currentLevel.description}`&quot;`</p>
                    <p>
                        {feedbackMessage && (
                            <span className="font-medium">{t("feedback")} </span>
                        )}
                        {feedbackMessage}
                    </p>
                </FeedbackPanel>
            )}
        </div>
    );
}