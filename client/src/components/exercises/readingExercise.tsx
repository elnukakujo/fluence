"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Languages, Volume2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Exercise from "@/interface/features/Exercise";
import { updateScoreById } from "@/api/process";
import ElementMediaCard from "@/components/elements/elementMediaCard";
import { useLineAudio } from "./lineAudio";

// 36px square target with an 8px gap between neighbours; the speaker column never wraps.
const ICON_BTN = "chip inline-flex h-9 w-9 shrink-0 items-center justify-center p-0";

type ReadingContent = { speakers: { id: string; name: string }[]; lines: { speakerId: string; text: string; translation?: string | null; audioIndex: number | null }[] };

export default function ReadingExercise({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const content = exercise.content as ReadingContent | undefined;
    const [shown, setShown] = useState<Record<number, boolean>>({});
    const [done, setDone] = useState(false);
    const startTimeRef = useRef<number>(performance.now());
    const audio = useLineAudio(exercise);

    useEffect(() => { setShown({}); setDone(false); startTimeRef.current = performance.now(); }, [exercise]);

    if (!content?.lines?.length) return null;
    const names = Object.fromEntries(content.speakers.map((s) => [s.id, s.name]));
    const multi = content.speakers.length > 1;

    // Reading has nothing to check: finishing it earns the point.
    const finish = () => {
        setDone(true);
        updateScoreById(exercise.id!, 1, Math.round(performance.now() - startTimeRef.current), false, 1).catch(console.error);
    };

    return (
        <div className="card flex flex-col space-y-4">
            {exercise.question && <h3>{exercise.question}</h3>}
            {exercise.text_support?.trim() && <Markdown remarkPlugins={[remarkGfm]}>{exercise.text_support}</Markdown>}
            <ElementMediaCard element={exercise} />
            <ol className="flex flex-col gap-3 list-none pl-0">
                {content.lines.map((line, i) => (
                    <li key={i} className="flex flex-col gap-1">
                        <div className="flex flex-row items-start gap-2">
                            {multi && <strong className="shrink-0 whitespace-nowrap">{names[line.speakerId]}</strong>}
                            <span className="flex-1">{line.text}</span>
                            {audio.hasAudio(line) && (
                                <button type="button" className={ICON_BTN} title={t("play")} aria-label={t("readingLinePlay", { n: i + 1 })}
                                    onClick={() => audio.play(line)}>
                                    <Volume2 size={16} />
                                </button>
                            )}
                            {line.translation && (
                                <button type="button" className={`${ICON_BTN} ${shown[i] ? "bg-accent text-primary-foreground" : ""}`} aria-pressed={!!shown[i]}
                                    title={shown[i] ? t("hideTranslation") : t("showTranslation")}
                                    aria-label={shown[i] ? t("hideTranslation") : t("showTranslation")}
                                    onClick={() => setShown((s) => ({ ...s, [i]: !s[i] }))}>
                                    <Languages size={16} />
                                </button>
                            )}
                        </div>
                        {shown[i] && line.translation && <p className="italic opacity-80">{line.translation}</p>}
                    </li>
                ))}
            </ol>
            {!done
                ? <button type="button" className="btn btn-primary self-end" onClick={finish}>{t("readingDone")}</button>
                : <p className="text-success self-end">{t("readingDoneMessage")}</p>}
            {audio.toast}
        </div>
    );
}
