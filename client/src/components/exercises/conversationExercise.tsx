"use client";

import { useFinished, type ExerciseRunnerProps } from "./exerciseFinish";
import { useEffect, useRef, useState } from "react";
import { Ring } from 'ldrs/react';
import { useTranslations } from "next-intl";
//@ts-ignore
import 'ldrs/react/Ring.css';
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from 'next/image';
import Exercise from "@/interface/features/Exercise";
import { updateScoreById, evaluateSpeech } from "@/api/process";
import { BASE_URL } from "@/api";
import { getLevelForScore } from "@/utils/speech_levels";

import dynamic from 'next/dynamic';
const AudioRecorder = dynamic(() => import('@/components/media/audioRecorder'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type Speaker = {
    id: string;
    name: string;
    isUser: boolean;
};

type ConversationLine = {
    speakerId: string;
    text: string;
    audioIndex: number | null;
};

type ConversationData = {
    speakers: Speaker[];
    lines: ConversationLine[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseConversation(raw: string): ConversationData {
    try { return JSON.parse(raw) as ConversationData; }
    catch { throw new Error("Failed to parse conversation data"); }
}

// ─── Per-user-line state ──────────────────────────────────────────────────────

type UserLineState = {
    audioUrl: string | null;
    resetKey: number;
    isCorrect: boolean;
    attempts: number;
    similarityScore: number | null;
    level: { label: string; description: string } | null;
    feedbackMessage: string | null;
};

function makeInitialLineState(): UserLineState {
    return { audioUrl: null, resetKey: 0, isCorrect: false, attempts: 0, similarityScore: null, level: null, feedbackMessage: null };
}

function SpeechLine({
    line,
    audioFiles,
    isUser,
    userName,
    isPlaying,
    registerAudioRef,
}: {
    line: ConversationLine;
    audioFiles: string[];
    isUser: boolean;
    userName: string;
    isPlaying: boolean;
    registerAudioRef?: (element: HTMLAudioElement | null) => void;
}) {
    if (line.audioIndex === null) {throw new Error("User lines must have an audio index for reference playback"); }
    const audioSrc = `${BASE_URL}${audioFiles[line.audioIndex]}`;
    const baseStyle = isUser ? 'text-accent border-accent/40' : 'text-muted border-border';
    const highlightStyle = isUser
        ? 'text-accent border-accent'
        : 'border-accent bg-accent-soft text-accent';

    return (
        <fieldset className={`card flex flex-col space-x-2 w-fit transition-colors ${isPlaying ? highlightStyle : baseStyle}`}>
            <h4 className="font-medium">{userName}</h4>
            <p className='text-sm italic'>{line.text}</p>
            <div>
                {isUser && (
                    <p className="text-xs text-muted">{/* t("reference") */}Reference:</p>
                )}
                <audio ref={registerAudioRef} src={audioSrc} controls className="h-8 w-48"/>
            </div>
        </fieldset>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConversationExercise({ exercise, onFinished }: Omit<ExerciseRunnerProps, "gaveUp">) {
    const t = useTranslations("exercises");
    const audioFiles = exercise.audio_files!;
    const textSupport = exercise.text_support || "";
    const imageFiles = exercise.image_files!;

    const conversation = parseConversation(exercise.question ?? "");

    // State keyed by line index (only user lines have entries)
    const [lineStates, setLineStates] = useState<Record<number, UserLineState>>(() => {
        const conversation = parseConversation(exercise.question ?? "");
        const initial: Record<number, UserLineState> = {};
        conversation.lines.forEach((line, idx) => {
            const speaker = conversation.speakers.find((s) => s.id === line.speakerId);
            if (speaker?.isUser) initial[idx] = makeInitialLineState();
        });
        return initial;
    });
    const [currentLineIndex, setCurrentLineIndex] = useState<number>(() =>
        conversation.lines.findIndex((line) =>
            conversation.speakers.find((s) => s.id === line.speakerId)?.isUser
        )
    );
    const [visibleLineIndex, setVisibleLineIndex] = useState<number>(() =>
        conversation.lines.findIndex((line) =>
            conversation.speakers.find((s) => s.id === line.speakerId)?.isUser
        )
    );
    const [isLoading, setIsLoading] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [playQueue, setPlayQueue] = useState<number[]>([]);
    const [playingLineIndex, setPlayingLineIndex] = useState<number | null>(null);
    const startTimeRef = useRef<number>(performance.now());

    const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
    const previousLineIndexRef = useRef<number>(currentLineIndex);
    const skipRevealEffectRef = useRef(true);
    const isSequencePlayingRef = useRef(false);
    useFinished(isFinished, onFinished);

    // Reset when exercise changes
    useEffect(() => {
        if (!conversation) return;
        const initial: Record<number, UserLineState> = {};
        Object.values(audioRefs.current).forEach((audio) => {
            if (!audio) return;
            audio.pause();
            audio.currentTime = 0;
        });

        conversation.lines.forEach((line, idx) => {
            const speaker = conversation.speakers.find((s) => s.id === line.speakerId);
            if (speaker?.isUser) initial[idx] = makeInitialLineState();
        });
        const firstUserLineIndex = conversation.lines.findIndex((line) =>
            conversation.speakers.find((s) => s.id === line.speakerId)?.isUser
        );

        setLineStates(initial);
        setCurrentLineIndex(firstUserLineIndex);
        setVisibleLineIndex(firstUserLineIndex);
        const initialNonUserLines = conversation.lines
            .map((line, idx) => ({ line, idx }))
            .filter(({ idx, line }) => {
                if (idx >= firstUserLineIndex) return false;
                const speaker = conversation.speakers.find((s) => s.id === line.speakerId);
                return Boolean(speaker && !speaker.isUser);
            })
            .map(({ idx }) => idx);

        setPlayQueue(initialNonUserLines);
        setPlayingLineIndex(null);
        isSequencePlayingRef.current = false;
        previousLineIndexRef.current = firstUserLineIndex;
        skipRevealEffectRef.current = true;
        startTimeRef.current = performance.now();
    }, [exercise.id]);

    useEffect(() => {
        if (skipRevealEffectRef.current) {
            skipRevealEffectRef.current = false;
            previousLineIndexRef.current = currentLineIndex;
            return;
        }

        const previousLineIndex = previousLineIndexRef.current;
        previousLineIndexRef.current = currentLineIndex;

        if (currentLineIndex <= previousLineIndex) return;

        const newlyRevealedNonUserLines: number[] = [];
        for (let idx = previousLineIndex + 1; idx <= currentLineIndex; idx += 1) {
            const speaker = conversation.speakers.find((candidate) => candidate.id === conversation.lines[idx]?.speakerId);
            if (speaker && !speaker.isUser) {
                newlyRevealedNonUserLines.push(idx);
            }
        }

        if (newlyRevealedNonUserLines.length === 0) return;

        setPlayQueue((previousQueue) => {
            const existing = new Set(previousQueue);
            const toAppend = newlyRevealedNonUserLines.filter((lineIndex) => !existing.has(lineIndex));
            return [...previousQueue, ...toAppend];
        });
    }, [conversation.lines, conversation.speakers, currentLineIndex]);

    useEffect(() => {
        if (isSequencePlayingRef.current || playQueue.length === 0) return;

        const nextLineIndex = playQueue[0];
        const audio = audioRefs.current[nextLineIndex];

        if (!audio) {
            setPlayQueue((previousQueue) => previousQueue.slice(1));
            return;
        }

        isSequencePlayingRef.current = true;
        setPlayingLineIndex(nextLineIndex);

        const finishPlayback = () => {
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("error", handleError);
            isSequencePlayingRef.current = false;
            setPlayingLineIndex((current) => (current === nextLineIndex ? null : current));
            setPlayQueue((previousQueue) => {
                if (previousQueue[0] === nextLineIndex) return previousQueue.slice(1);
                return previousQueue.filter((lineIndex) => lineIndex !== nextLineIndex);
            });
        };

        const handleEnded = () => finishPlayback();
        const handleError = () => finishPlayback();

        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("error", handleError);
        audio.currentTime = 0;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch((error) => {
                console.warn("Could not autoplay revealed conversation line", error);
                finishPlayback();
            });
        }
    }, [playQueue]);

    const userLineIndices = conversation.lines.reduce<number[]>((acc, line, idx) => {
        if (conversation.speakers.find((s) => s.id === line.speakerId)?.isUser) acc.push(idx);
        return acc;
    }, []);

    const updateLine = (idx: number, patch: Partial<UserLineState>) =>
        setLineStates((prev) => ({ ...prev, [idx]: { ...prev[idx], ...patch } }));

    const handleEvaluation = async () => {
        const state = lineStates[currentLineIndex];
        if (!state?.audioUrl || isLoading) return;
 
        setIsLoading(true);
 
        try {
            const result = await evaluateSpeech(String(exercise.id), state.audioUrl, conversation.lines[currentLineIndex].audioIndex!);
            const level = getLevelForScore(result.score, "conversation");
            const newAttempts = state.attempts + 1;
            const isLastUserLine = currentLineIndex === userLineIndices[userLineIndices.length - 1];
 
            if (result.correct) {
                updateLine(currentLineIndex, {
                    isCorrect: true,
                    level,
                    similarityScore: result.score,
                    feedbackMessage: result.feedback,
                });
 
                if (isLastUserLine) {
                    const trailingNonUserLines = conversation.lines
                        .map((line, idx) => ({ line, idx }))
                        .filter(({ idx, line }) => {
                            if (idx <= currentLineIndex) return false;
                            const speaker = conversation.speakers.find((s) => s.id === line.speakerId);
                            return Boolean(speaker && !speaker.isUser);
                        })
                        .map(({ idx }) => idx);

                    if (trailingNonUserLines.length > 0) {
                        setPlayQueue((previousQueue) => {
                            const existing = new Set(previousQueue);
                            const toAppend = trailingNonUserLines.filter((lineIndex) => !existing.has(lineIndex));
                            return [...previousQueue, ...toAppend];
                        });
                    }

                    setVisibleLineIndex(conversation.lines.length - 1);
                    const averageScore = userLineIndices.reduce((acc, idx) => acc + (lineStates[idx]?.similarityScore ?? 0), 0) / userLineIndices.length;
                    const duration_ms = Math.round(performance.now() - startTimeRef.current);
                    const attemptNumber = userLineIndices.reduce((acc, idx) => acc + (lineStates[idx]?.attempts ?? 0), 0) + userLineIndices.length;
                    updateScoreById(exercise.id!, averageScore, duration_ms, false, attemptNumber).catch(console.error);
                    setIsFinished(true);
                } else {
                    const nextUserLine = userLineIndices.find((i) => i > currentLineIndex)!;
                    setCurrentLineIndex(nextUserLine);
                    setVisibleLineIndex(nextUserLine);
                }
            } else {
                updateLine(currentLineIndex, {
                    isCorrect: false,
                    level,
                    similarityScore: result.score,
                    attempts: newAttempts,
                    feedbackMessage: result.feedback,
                });
 
                if (newAttempts >= 3) {
                    const duration_ms = Math.round(performance.now() - startTimeRef.current);
                    const completedUserLines = userLineIndices.filter((idx) => idx < currentLineIndex).length;
                    const previousAttempts = userLineIndices
                        .filter((idx) => idx < currentLineIndex)
                        .reduce((acc, idx) => acc + (lineStates[idx]?.attempts ?? 0) + 1, 0);
                    updateScoreById(exercise.id!, 0, duration_ms, false, previousAttempts + newAttempts).catch(console.error);
                    setIsFinished(true);
                }
            }
        } catch (err) {
            console.error("Error evaluating speaking:", err);
            alert("Failed to evaluate your speech. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form className="card flex flex-col gap-4">
            {textSupport.trim() !== "" && (
                <section>
                    <h3>{t("support")}</h3>
                    <Markdown remarkPlugins={[remarkGfm]}>{textSupport}</Markdown>
                </section>
            )}

            {imageFiles.length > 0 && (
                <section>
                    {imageFiles.map((src, i) => (
                        <Image key={i} src={`${BASE_URL}${src}`} alt={t("support")} width={300} height={300} />
                    ))}
                </section>
            )}

            <section className="index-divider flex flex-col gap-3">
                {conversation.lines.map((line, idx) => {
                    if (idx > visibleLineIndex) return;
                    const speaker = conversation.speakers.find((s) => s.id === line.speakerId);
                    if (!speaker) throw new Error(`Speaker with ID ${line.speakerId} not found in conversation data`);
                    if (!lineStates[idx] && speaker.isUser) { throw new Error(`Missing state for line ${idx} - speaker ${line.speakerId}`); }

                    const speakerIdx = conversation.speakers.findIndex((s) => s.id === line.speakerId);
                    const n = conversation.speakers.length;
                    // Each speaker occupies a 1/n-wide column; the column starts at speakerIdx/n of the total width
                    const widthPercent = 100 / n;
                    const marginLeftPercent = (speakerIdx / n) * 100;

                    return (
                        <section
                            className="flex flex-col space-y-4 items-center"
                            key={idx}
                            style={{
                                width: `${widthPercent}%`,
                                marginLeft: `${marginLeftPercent}%`,
                            }}
                        >
                            <SpeechLine
                                line={line}
                                audioFiles={audioFiles}
                                isUser={speaker.isUser}
                                userName={speaker.name}
                                isPlaying={playingLineIndex === idx}
                                registerAudioRef={(element) => {
                                    audioRefs.current[idx] = element;
                                }}
                            />
                            {speaker.isUser && idx === currentLineIndex && (
                                <span className="flex flex-row space-x-2 items-center">
                                    <AudioRecorder
                                        key={lineStates[idx].resetKey}
                                        onUploadSuccess={(response) => updateLine(idx, { audioUrl: (response as { file_path: string })["file_path"] })}
                                        onUploadError={(err: unknown) => { console.error("Audio upload error:", err); alert("Failed to upload audio. Please try again."); }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => handleEvaluation()}
                                        disabled={!lineStates[idx].audioUrl|| lineStates[idx].attempts >= 3}
                                    >
                                        {isLoading ? <Ring size={20} color="#fff" /> : t("submit")}
                                    </button>
                                </span>
                            )}
                            {speaker.isUser && (lineStates[idx]?.isCorrect || (lineStates[idx]?.attempts ?? 0) > 0) && lineStates[idx]?.level && lineStates[idx]?.similarityScore !== null && (
                                <section className={`card max-w-sm text-sm ${lineStates[idx].isCorrect ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                                    <p className="font-semibold">
                                        {lineStates[idx].isCorrect ? t("goodPronunciation") : t("needsImprovement")}
                                    </p>
                                    <p>
                                        {t("similarity", { score: (lineStates[idx].similarityScore * 100).toFixed(1) })}
                                    </p>
                                    <p>
                                        {t("level")}{lineStates[idx].level.label}
                                    </p>
                                    <p className="opacity-90">{lineStates[idx].level.description}</p>
                                    <p>
                                        {lineStates[idx].feedbackMessage && (
                                            <span className="font-medium">{t("feedback")} </span>
                                        )}
                                        {lineStates[idx].feedbackMessage}
                                    </p>
                                </section>
                            )}
                        </section>
                    );
                })}
            </section>
            {isFinished && (
                <section className={`card mt-4 ${userLineIndices.every((i) => lineStates[i]?.isCorrect) ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    <h3 className="text-lg font-semibold">{t("exerciseCompleted")}</h3>
                    <p className="mt-2">
                        {userLineIndices.every((i) => lineStates[i]?.isCorrect)
                            ? t("wellDone")
                            : t("failedPronounce", { correct: userLineIndices.filter((i) => lineStates[i]?.isCorrect).length, total: userLineIndices.length })}
                    </p>
                </section>
            )}
        </form>
    );
}