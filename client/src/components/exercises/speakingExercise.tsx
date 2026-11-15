"use client";

import { type ExerciseRunnerProps } from "./exerciseFinish";
import { useEffect, useState, useCallback } from "react";
import { useAttemptScoring } from "./useAttemptScoring";
import { Ring } from 'ldrs/react';
import { useTranslations } from "next-intl";
//@ts-ignore
import 'ldrs/react/Ring.css';
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { evaluateSpeech } from "@/api/process";
import dynamic from 'next/dynamic';
import { getExerciseLevel } from "@/utils/speech_levels";
import ElementMediaCard from "@/components/elements/elementMediaCard";
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
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!hasRecording || isLoading}
                        className="btn btn-primary"
                    >
                        {isLoading
                            ? <Ring size="24" stroke="2" bgOpacity="0" speed="3" color="white" />
                            : <p>{t("checkAnswer")}</p>
                        }
                    </button>
                </section>
            )}

            {hasFeedback && currentLevel && (
                <div className={`card mt-4 ${correct
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-danger/30 bg-danger/10 text-danger"}`}
                >
                    <h3>{currentLevel.label}</h3>
                    <p className="italic">`&quot;`{currentLevel.description}`&quot;`</p>
                    <p>
                        {feedbackMessage && (
                            <span className="font-medium">{t("feedback")} </span>
                        )}
                        {feedbackMessage}
                    </p>
                </div>
            )}
        </div>
    );
}