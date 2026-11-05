"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, Rocket } from "lucide-react";
import { setExerciseUserPref } from "@/api/exercise";

type Mode = "boost" | "ban" | null;

/** This user's own boost / ban on one exercise (a type-level ban is set in the settings and shown as a badge). */
export default function ExerciseUserPrefMenu({ exerciseId, mode }: { exerciseId: string; mode: Mode | undefined }) {
    const t = useTranslations("study");
    const router = useRouter();
    const [current, setCurrent] = useState<Mode>(mode ?? null);
    const [busy, setBusy] = useState(false);

    const choose = async (next: Exclude<Mode, null>) => {
        const value = current === next ? null : next;   // pressing the active mode resets it
        setBusy(true);
        try {
            await setExerciseUserPref(exerciseId, value);
            setCurrent(value);
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="filter-chips" role="group" aria-label={t("exerciseModeLabel")}>
            <button type="button" disabled={busy} aria-pressed={current === "boost"} className={`filter-chip inline-flex items-center gap-1 min-h-11 ${current === "boost" ? "active" : ""}`} onClick={() => choose("boost")}>
                <Rocket size={14} aria-hidden />{t("boost")}
            </button>
            <button type="button" disabled={busy} aria-pressed={current === "ban"} className={`filter-chip inline-flex items-center gap-1 min-h-11 ${current === "ban" ? "active" : ""}`} onClick={() => choose("ban")}>
                <Ban size={14} aria-hidden />{t("ban")}
            </button>
        </div>
    );
}
