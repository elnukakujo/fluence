"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import GenerationReview from "./generationReview";

/** Lesson-page banner for generated exercises still waiting for review; opens the review step. */
export default function GenerationBanner({ lessonId, count }: { lessonId: string; count: number }) {
    const t = useTranslations("exercises");
    const [open, setOpen] = useState(false);
    if (count <= 0) return null;
    return (
        <>
            <button type="button" className="badge badge-warn min-h-11 inline-flex items-center gap-2 self-start" onClick={() => setOpen(true)}>
                <AlertTriangle size={14} aria-hidden />{t("reviewBanner", { count })}
            </button>
            {open && <GenerationReview lessonId={lessonId} onClose={() => setOpen(false)} />}
        </>
    );
}
