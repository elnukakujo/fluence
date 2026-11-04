"use client";

import Exercise from "@/interface/features/Exercise";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import ExerciseRunner from "./exerciseRunner";
import BackButton from "@/components/ui/buttons/backButton";
import ProgressBar from "../ui/progressBar";

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

export default function ExercisePractice( { exercise_lists, lang } : { exercise_lists: Exercise[]; lang?: string }) {
    const t = useTranslations("exercises");
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [currentExercise, setCurrentExercise] = useState<Exercise>(exercise_lists[currentIndex]);
    const isLastExercise = currentIndex === exercise_lists.length - 1;

    useEffect(() => {
        setCurrentExercise(exercise_lists[currentIndex]);
    }, [currentIndex, exercise_lists]);

    return (
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
            <ProgressBar
                current={currentIndex}
                total={exercise_lists.length}
            />
            <div className="flex items-center justify-between">
                <span className="badge">{EXERCISE_TYPE_LABELS[currentExercise.exercise_type ?? ""] ? t(EXERCISE_TYPE_LABELS[currentExercise.exercise_type ?? ""]) : currentExercise.exercise_type}</span>
            </div>
            <div key={currentExercise.id ?? currentIndex} className="animate-fade-in">
                <ExerciseRunner exercise={currentExercise} lang={lang} />
            </div>
            {!isLastExercise ? (
                <button
                    className="btn btn-primary self-end"
                    onClick={() => setCurrentIndex(currentIndex+1)}>
                    {t("nextExercise")}
                </button>
            ) : (
                <section className="card index-divider flex flex-col items-center gap-3 text-center">
                    <p className="font-medium">{t("completedAll")}</p>
                    <BackButton>
                        <p>{t("backToLesson")}</p>
                    </BackButton>
                </section>
            )}
        </div>
    );
}