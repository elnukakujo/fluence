"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, Target } from "lucide-react";
import NavButton from "@/components/layout/navButton";
import ListCard, { average } from "@/components/elements/listCard";
import type Exercise from "@/interface/features/Exercise";

export default function ExerciseList({ exProps }: { exProps: Exercise[] }) {
    const t = useTranslations("exercises");
    const { language_id, lesson_id } = useParams<{ language_id: string, lesson_id: string }>();
    const base = `/languages/${language_id}/lesson/${lesson_id}/ex`;

    return (
        <ListCard icon={Target} title={t("exercises")} count={exProps.length} score={average(exProps, (e) => e.score)} difficulty={average(exProps, (e) => e.difficulty)}
            addPath={`${base}/new`} practicePath={`${base}/practice`}>
            <NavButton path={base} className="pick-row"><span className="pick-main flex-1 text-left">{t("seeExercises")}</span><ChevronRight size={16} className="shrink-0 text-muted" aria-hidden /></NavButton>
        </ListCard>
    );
}
