"use client";

import { useEffect, useRef, useState } from "react";
import { Ring } from "ldrs/react";
import { useTranslations } from "next-intl";
import "ldrs/react/Ring.css";
import Exercise from "@/interface/features/Exercise";
import { evaluateText, updateScoreById } from "@/api/process";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import { getLevelForScore } from "@/utils/speech_levels";
import { useLineAudio } from "./lineAudio";
import LineAudioButton from "./lineAudioButton";
import GenerateAudioButton from "./generateAudioButton";

type DictationContent = { lines: { text: string; audioIndex: number | null }[] };

export default function DictationExercise({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const lines = (exercise.content as DictationContent | undefined)?.lines ?? [];
    const [index, setIndex] = useState(0);
    const [typed, setTyped] = useState<string[]>([]);
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string | null; level: string; correct: boolean } | null>(null);
    const startTimeRef = useRef<number>(performance.now());
    const audio = useLineAudio(exercise);

    useEffect(() => { setIndex(0); setTyped([]); setDone(false); setFeedback(null); startTimeRef.current = performance.now(); }, [exercise]);

    if (!lines.length) return null;
    if (exercise.needs?.length) return <div className="card"><h3>{exercise.question}</h3><p>{t("dictationNeedsAudio")}</p><GenerateAudioButton exercise={exercise} /></div>;
    const last = index === lines.length - 1;
    const set = (v: string) => setTyped((a) => { const n = [...a]; n[index] = v; return n; });

    const submit = async () => {
        const text = lines.map((_, i) => (typed[i] ?? "").trim()).filter(Boolean).join(" ");
        setLoading(true);
        let score = 0, message: string | null = null, correct = false;
        try {
            if (text) {   // nothing typed = score 0, no server call
                const result = await evaluateText(exercise.id!, text);
                score = result.score; message = result.feedback; correct = result.correct === true;
            }
            setFeedback({ message, correct, level: getLevelForScore(score, "translate").label });
            setDone(true);
            updateScoreById(exercise.id!, score, Math.round(performance.now() - startTimeRef.current), false, 1).catch(console.error);
        } catch (e) {
            console.error("Error evaluating dictation:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card flex flex-col space-y-4">
            <h3>{exercise.question}</h3>
            <ElementMediaCard element={{ ...exercise, audio_files: [] }} />   {/* the per-line control is the only audio */}
            {!done ? (
                <section className="flex flex-col gap-3">
                    <p className="text-xs">{t("lineOf", { current: index + 1, total: lines.length })}</p>
                    <LineAudioButton audio={audio} line={lines[index]} label={t("readingLinePlay", { n: index + 1 })} />
                    <AutoSizeTextArea value={typed[index] ?? ""} onChange={(e) => set(e.target.value)} placeholder={t("dictationPlaceholder")} />
                    {last ? (
                        <button type="button" className="btn btn-primary" disabled={loading} onClick={submit}>
                            {loading ? <Ring size="24" stroke="2" bgOpacity="0" speed="3" color="white" /> : <p>{t("checkAnswer")}</p>}
                        </button>
                    ) : (
                        <button type="button" className="btn btn-primary" onClick={() => setIndex(index + 1)}>{t("nextLine")}</button>
                    )}
                </section>
            ) : feedback && (
                <div className={`card ${feedback.correct ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
                    <h3>{feedback.level}</h3>
                    {feedback.message && <p>{feedback.message}</p>}
                    <p>{t("correctAnswer")} {exercise.answer}</p>
                </div>
            )}
            {audio.toast}
        </div>
    );
}
