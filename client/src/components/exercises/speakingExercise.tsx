"use client";

import { useFinished, type ExerciseRunnerProps } from "./exerciseFinish";
import { useEffect, useState, useCallback, useRef } from "react";
import { Ring } from 'ldrs/react';
import { useTranslations } from "next-intl";
//@ts-ignore
import 'ldrs/react/Ring.css';
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Exercise from "@/interface/features/Exercise";
import { updateScoreById, evaluateSpeech } from "@/api/process";
import dynamic from 'next/dynamic';
import { getLevelForScore } from "@/utils/speech_levels";
import ElementMediaCard from "@/components/elements/elementMediaCard";
const AudioRecorder = dynamic(() => import('@/components/media/audioRecorder'), { ssr: false });

export default function SpeakingExercise({ exercise, onFinished }: Omit<ExerciseRunnerProps, "gaveUp">) {
    const t = useTranslations("exercises");
    const question = exercise.question || "";
    const text_support = exercise.text_support || "";

    const [attempts, setAttempts] = useState<number>(0);
    const [isCorrect, setIsCorrect] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentLevel, setCurrentLevel] = useState<{ label: string; description: string } | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const hasFeedback = isCorrect || attempts > 0;
    const startTimeRef = useRef<number>(performance.now());
    useFinished(isCorrect || attempts >= 3, onFinished);

    // Lifted state from AudioRecorder via onStatusChange
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [resetKey, setResetKey] = useState<number>(0); // remounts AudioRecorder on exercise change
    const [showExample, setShowExample] = useState<boolean>(false);

    const hasRecording = !!audioUrl;

    // Reset everything when the exercise changes
    useEffect(() => {
        setAttempts(0);
        setIsCorrect(false);
        setCurrentLevel(null);
        setAudioUrl(null);
        setFeedbackMessage(null);
        setResetKey((k) => k + 1); // remount AudioRecorder to clear its state
        startTimeRef.current = performance.now();
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
            setCurrentLevel(getLevelForScore(result.score, "speaking"));

            if (result.correct) {
                setIsCorrect(true);
                const duration_ms = Math.round(performance.now() - startTimeRef.current);
                updateScoreById(exercise.id!, 1, duration_ms, false, attempts + 1).catch(console.error);
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                if (newAttempts >= 3) {
                    const duration_ms = Math.round(performance.now() - startTimeRef.current);
                    updateScoreById(exercise.id!, 0, duration_ms, false, newAttempts).catch(console.error);
                }
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

            {!isCorrect && attempts < 3 && (
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
                <div className={`card mt-4 ${isCorrect
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