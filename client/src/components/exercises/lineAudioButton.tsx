"use client";

import { useTranslations } from "next-intl";
import { Volume2 } from "lucide-react";
import type { useLineAudio } from "./lineAudio";

// 36px square target with an 8px gap between neighbours; the speaker column never wraps.
export const ICON_BTN = "chip inline-flex h-9 w-9 shrink-0 items-center justify-center p-0";

/** The one play control of a reading / dictation line; nothing when the line has no stored clip. */
export default function LineAudioButton({ audio, line, label }: { audio: ReturnType<typeof useLineAudio>; line: { audioIndex: number | null }; label: string }) {
    const t = useTranslations("exercises");
    if (!audio.hasAudio(line)) return null;
    return (
        <button type="button" className={ICON_BTN} title={t("play")} aria-label={label} onClick={() => audio.play(line)}>
            <Volume2 size={16} aria-hidden />
        </button>
    );
}
