"use client";

import Exercise from "@/interface/features/Exercise";
import { useState } from "react";
import { useTranslations } from "next-intl";

import ExerciseRunner from "./exerciseRunner";
import BackButton from "@/components/ui/buttons/backButton";
import ProgressBar from "../ui/progressBar";
import SkipToggles from "./skipToggles";
import { isSkipped, type Skips } from "@/utils/exerciseSkills";

const EXERCISE_TYPE_LABELS: Record<string, string> = {
    essay: "essay",
    answering: "answering",
    translate: "translate",
    organize: "organize",
    type_in_the_blank: "typeInTheBlank",
    select_in_the_blank: "selectInTheBlank",
    matching: "matching",
    true_false: "trueFalse",
    speaking: "speaking",
    conversation: "conversation",
    quizz: "quizz",
    reading: "reading",
    dictation: "dictation",
};

export default function ExercisePractice( { exercise_lists } : { exercise_lists: Exercise[] }) {
    const t = useTranslations("exercises");
    const [skips, setSkips] = useState<Skips>({ hear: false, speak: false });
    const [done, setDone] = useState<string[]>([]);   // finished exercises; the queue is derived, so un-skipping restores the original order
    const remaining = exercise_lists.filter((e) => !done.includes(e.id!) && !isSkipped(e, skips));
    const skippedCount = exercise_lists.filter((e) => !done.includes(e.id!) && isSkipped(e, skips)).length;
    const currentExercise: Exercise | undefined = remaining[0];
    const isLastExercise = remaining.length <= 1;

    return (
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
            <SkipToggles value={skips} onChange={setSkips} skippedCount={skippedCount} />
            <ProgressBar
                current={done.length}
                total={done.length + remaining.length}
            />
            {currentExercise ? (<>
            <div className="flex items-center justify-between">
                <span className="badge">{EXERCISE_TYPE_LABELS[currentExercise.exercise_type ?? ""] ? t(EXERCISE_TYPE_LABELS[currentExercise.exercise_type ?? ""]) : currentExercise.exercise_type}</span>
            </div>
            <div key={currentExercise.id} className="animate-fade-in">
                <ExerciseRunner exercise={currentExercise} />
            </div>
            </>) : (
                <p className="text-muted">{t("nothingLeft")}</p>
            )}
            {currentExercise && !isLastExercise ? (
                <button
                    className="btn btn-primary self-end"
                    onClick={() => setDone([...done, currentExercise.id!])}>
                    {t("nextExercise")}
                </button>
            ) : (
                <section className="card index-divider flex flex-col items-center gap-3 text-center">
                    {(currentExercise || skippedCount === 0) && <p className="font-medium">{t("completedAll")}</p>}
                    <BackButton>
                        <p>{t("backToLesson")}</p>
                    </BackButton>
                </section>
            )}
        </div>
    );
}