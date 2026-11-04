"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Exercise from "@/interface/features/Exercise";
import { updateScoreById } from "@/api/process";
import RecallGradeButtons from "@/components/ui/buttons/recallGradeButtons";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import { playLine } from "./lineAudio";
const AudioRecorder = dynamic(() => import("@/components/media/audioRecorder"), { ssr: false });

type ReadingContent = { speakers: { id: string; name: string }[]; lines: { speakerId: string; text: string; translation?: string | null; audioIndex: number | null }[] };

export default function ReadingExercise({ exercise, lang }: { exercise: Exercise; lang?: string }) {
    const t = useTranslations("exercises");
    const content = exercise.content as ReadingContent | undefined;
    const [shown, setShown] = useState<Record<number, boolean>>({});
    const [takes, setTakes] = useState<Record<number, string>>({});   // local recordings, never uploaded
    const [graded, setGraded] = useState(false);
    const startTimeRef = useRef<number>(performance.now());

    useEffect(() => { setShown({}); setTakes({}); setGraded(false); startTimeRef.current = performance.now(); }, [exercise]);

    if (!content?.lines?.length) return null;
    const names = Object.fromEntries(content.speakers.map((s) => [s.id, s.name]));
    const multi = content.speakers.length > 1;

    const grade = (score: number) => {
        setGraded(true);
        updateScoreById(exercise.id!, score, Math.round(performance.now() - startTimeRef.current), false, 1).catch(console.error);
    };

    return (
        <div className="card flex flex-col space-y-4">
            <h3>{exercise.question}</h3>
            {exercise.text_support?.trim() && <Markdown remarkPlugins={[remarkGfm]}>{exercise.text_support}</Markdown>}
            <ElementMediaCard element={exercise} />
            <ol className="flex flex-col gap-3">
                {content.lines.map((line, i) => (
                    <li key={i} className="flex flex-col gap-1">
                        <div className="flex flex-row items-center gap-2">
                            {multi && <strong>{names[line.speakerId]}</strong>}
                            <span>{line.text}</span>
                            <button type="button" className="btn btn-secondary" aria-label={t("readingLinePlay", { n: i + 1 })}
                                onClick={() => playLine(exercise.audio_files, line.audioIndex, line.text, lang)}>{t("play")}</button>
                            {line.translation && (
                                <button type="button" className="btn btn-secondary" onClick={() => setShown((s) => ({ ...s, [i]: !s[i] }))}>
                                    {shown[i] ? t("hideTranslation") : t("showTranslation")}
                                </button>
                            )}
                            <AudioRecorder localOnly onRecorded={(url: string) => setTakes((m) => ({ ...m, [i]: url }))} />
                        </div>
                        {shown[i] && line.translation && <p className="italic">{line.translation}</p>}
                        {takes[i] && <audio src={takes[i]} controls className="h-8 w-48" aria-label={t("replayRecording")} />}
                    </li>
                ))}
            </ol>
            {!graded && <RecallGradeButtons onGrade={grade} />}
        </div>
    );
}
