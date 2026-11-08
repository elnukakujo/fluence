"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { updateExercise } from "@/api/exercise";
import type Exercise from "@/interface/features/Exercise";

/** Accepts a generated / imported exercise waiting for review (clears `review_reason`), then refreshes. */
export default function AcceptExerciseButton({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    if (!exercise.review_reason) return null;
    const run = async () => {
        setBusy(true); setError(false);
        try {
            await updateExercise(exercise.id!, { exercise_type: exercise.exercise_type, question: exercise.question, answer: exercise.answer,
                text_support: exercise.text_support ?? undefined, content: exercise.content ?? undefined, lesson_id: exercise.lesson_id, review_reason: null });
            router.refresh();
        } catch { setError(true); } finally { setBusy(false); }
    };
    return (
        <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted">{exercise.review_reason}</p>
            <button type="button" className="btn btn-primary inline-flex items-center gap-2" disabled={busy} onClick={run}>
                <Check size={16} aria-hidden />{t("acceptExercise")}
            </button>
            {error && <p role="alert" className="text-danger">{t("acceptFailed")}</p>}
        </div>
    );
}
