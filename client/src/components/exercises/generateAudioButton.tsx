"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Volume2 } from "lucide-react";
import { generateLineAudio } from "@/api/exercise";
import type Exercise from "@/interface/features/Exercise";

/** Generates, with the user's TTS endpoint, the clip of every reading / dictation line that has none, then refreshes. */
export default function GenerateAudioButton({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const lines = (exercise.content as { lines?: { audioIndex: number | null }[] } | undefined)?.lines ?? [];
    const files = exercise.audio_files ?? [];
    const missing = lines.map((l, i) => (typeof l.audioIndex === "number" && files[l.audioIndex] ? -1 : i)).filter((i) => i >= 0);
    if (!missing.length) return null;

    const run = async () => {
        setBusy(true); setError(false);
        try {
            for (const i of missing) await generateLineAudio(exercise.id!, i);
            router.refresh();
        } catch { setError(true); } finally { setBusy(false); }
    };
    return (
        <div className="flex flex-col items-start gap-2">
            <button type="button" className="btn btn-secondary inline-flex items-center gap-2" disabled={busy} onClick={run}>
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Volume2 size={16} aria-hidden />}
                {busy ? t("generatingAudio") : t("generateAudio")}
            </button>
            {error && <p role="alert" className="text-danger">{t("ttsFailed")}</p>}
        </div>
    );
}
