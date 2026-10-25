"use client";

import Exercise from "@/interface/features/Exercise";
import { useEffect, useState } from "react";

import ExerciseRunner from "./exerciseRunner";
import BackButton from "@/components/ui/buttons/backButton";
import ProgressBar from "../ui/progressBar";

const EXERCISE_TYPE_LABELS: Record<string, string> = {
    essay: "Essay",
    answering: "Answering",
    translate: "Translate",
    organize: "Organize",
    type_in_the_blank: "Type in the Blank",
    select_in_the_blank: "Select in the Blank",
    matching: "Matching",
    true_false: "True / False",
    speaking: "Speaking",
    conversation: "Conversation",
    quizz: "Quizz",
};

export default function ExercisePractice( { exercise_lists } : { exercise_lists: Exercise[] }) {
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
                <span className="badge">{EXERCISE_TYPE_LABELS[currentExercise.exercise_type ?? ""] ?? currentExercise.exercise_type}</span>
            </div>
            <div key={currentExercise.id ?? currentIndex} className="animate-fade-in">
                <ExerciseRunner exercise={currentExercise} />
            </div>
            {!isLastExercise ? (
                <button
                    className="btn btn-primary self-end"
                    onClick={() => setCurrentIndex(currentIndex+1)}>
                    Next Exercise
                </button>
            ) : (
                <section className="card index-divider flex flex-col items-center gap-3 text-center">
                    <p className="font-medium">You have completed all exercises!</p>
                    <BackButton>
                        <p>Back to Lesson</p>
                    </BackButton>
                </section>
            )}
        </div>
    );
}