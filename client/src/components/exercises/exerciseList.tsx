"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import NavButton from "@/components/layout/navButton";
import Exercise from "@/interface/features/Exercise";
import DifficultyDisplay from "@/components/ui/displays/difficultyDisplay";
import ScoreDisplay from "@/components/ui/displays/scoreDisplay";

export default function ExerciseList({ exProps}: { exProps: Exercise[]}) {
    const t = useTranslations("exercises");
    const { language_id, lesson_id } = useParams<{ language_id: string, lesson_id: string }>();

    const averageScore = exProps.reduce((acc, item) => acc + item.score!, 0) / exProps.length;
    const averageDifficulty = exProps.reduce((acc, item) => acc + item.difficulty!, 0) / exProps.length;

    return (
        <section className="card flex flex-col gap-4 w-[14rem] h-fit">
            <header>
                <h2>Exercises</h2>
                {exProps.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted">{t("totalExercises")} {exProps.length}</span>
                        <ScoreDisplay score={averageScore} />
                        <DifficultyDisplay difficulty={averageDifficulty} />
                    </div>
                ) : (
                    <p>Empty</p>
                )}
            </header>
            <nav className="index-divider flex flex-col gap-2">
                <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/ex`}>
                    <span>{t("seeExercises")}</span>
                </NavButton>
                <NavButton
                    path = {`/languages/${language_id}/lesson/${lesson_id}/ex/new`}
                >
                    <span>{t("addNewExercise")}</span>
                </NavButton>
                {exProps.length > 0 && (
                    <NavButton
                        path={`/languages/${language_id}/lesson/${lesson_id}/ex/practice`}
                    >
                        <p>{t("exercisePractice")}</p>
                    </NavButton>)}

            </nav>
        </section>
    );
}
