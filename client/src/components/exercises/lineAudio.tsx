"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PUBLIC_BASE_URL } from "@/api";
import type Exercise from "@/interface/features/Exercise";

type Line = { audioIndex: number | null };

/** Plays the stored clip of a reading / dictation line. Nothing is generated here (see GenerateAudioButton):
 *  a line without a clip has no play button (`hasAudio`). `toast` warns when the browser cannot play a clip. */
export function useLineAudio(exercise: Exercise) {
    const t = useTranslations("exercises");
    const files = exercise.audio_files ?? [];
    const [warning, setWarning] = useState("");
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);

    const hasAudio = (line: Line) => typeof line.audioIndex === "number" && !!files[line.audioIndex];
    const play = useCallback((line: Line) => {
        if (typeof line.audioIndex !== "number" || !files[line.audioIndex]) return;
        new Audio(PUBLIC_BASE_URL + files[line.audioIndex]).play().catch(() => {
            setWarning(t("audioPlayFailed"));
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setWarning(""), 5000);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files]);

    const toast = warning
        ? <p role="alert" className="bulk-toast bulk-toast-warn fixed bottom-6 left-1/2 z-50 -translate-x-1/2">{warning}</p>
        : null;
    return { play, hasAudio, toast };
}
