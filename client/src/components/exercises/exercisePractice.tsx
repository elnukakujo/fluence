"use client";

import Exercise from "@/interface/features/Exercise";
import { useState } from "react";
import { useTranslations } from "next-intl";

import ExerciseRunner from "./exerciseRunner";
import BackButton from "@/components/ui/buttons/backButton";
import ProgressBar from "../ui/progressBar";
import ExerciseFooter from "./exerciseFooter";

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
    const [done, setDone] = useState<string[]>([]);
    const [skipped, setSkipped] = useState(0);
    const remaining = exercise_lists.filter((e) => !done.includes(e.id!));
    const currentExercise: Exercise | undefined = remaining[0];
    const [finishedId, setFinishedId] = useState<string>();   // the exercise whose answer is final (solved, out of attempts or given up)
    const [gaveUpId, setGaveUpId] = useState<string>();
    const gaveUp = !!currentExercise && gaveUpId === currentExercise.id;
    const finished = gaveUp || (!!currentExercise && finishedId === currentExercise.id);
    const finish = (skip: boolean) => { setDone([...done, currentExercise!.id!]); if (skip) setSkipped(skipped + 1); };

    return (
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
            <ProgressBar
                current={done.length}
                total={done.length + remaining.length}
            />
            {currentExercise ? (<>
            <div className="flex items-center justify-between">
                <span className="badge">{EXERCISE_TYPE_LABELS[currentExercise.exercise_type ?? ""] ? t(EXERCISE_TYPE_LABELS[currentExercise.exercise_type ?? ""]) : currentExercise.exercise_type}</span>
            </div>
            <div key={currentExercise.id} className="animate-fade-in">
                <ExerciseRunner exercise={currentExercise} gaveUp={gaveUp} onFinished={() => setFinishedId(currentExercise.id)} />
            </div>
            </>) : null}
            {currentExercise && (
                <ExerciseFooter exercise={currentExercise} finished={finished} isLast={false} onGiveUp={() => setGaveUpId(currentExercise.id)} onSkip={() => finish(true)} onNext={() => finish(false)} />
            )}
            {!currentExercise && (
                <section className="card index-divider flex flex-col items-center gap-3 text-center">
                    <p className="font-medium">{t("completedAll")}</p>
                    {skipped > 0 && <p role="status" className="text-sm text-muted">{t("skippedCount", { count: skipped })}</p>}
                    <BackButton>
                        <p>{t("backToLesson")}</p>
                    </BackButton>
                </section>
            )}
        </div>
    );
}
