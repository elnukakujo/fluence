"use client";

import type Exercise from "@/interface/features/Exercise";
import EssayExercise from "./essayExercise";
import AnsweringExercise from "./answeringExercise";
import TypeInTheBlankExercise from "./typeInTheBlankExercise";
import MatchingExercise from "./matchingExercise";
import OrganizeExercise from "./organizeExercise";
import TranslateExercise from "./translateExercise";
import TrueFalseExercise from "./trueFalseExercise";
import SpeakingExercise from "./speakingExercise";
import ConversationExercise from "./conversationExercise";
import SelectInTheBlankExercise from "./selectInTheBlankExercise";
import QuizzExercise from "./quizzExercise";

/** Renders a single exercise with its interactive component, by type. */
export default function ExerciseRunner({ exercise }: { exercise: Exercise }) {
    switch (exercise.exercise_type) {
        case "essay": return <EssayExercise exercise={exercise} />;
        case "answering": return <AnsweringExercise exercise={exercise} />;
        case "type_in_the_blank": return <TypeInTheBlankExercise exercise={exercise} />;
        case "select_in_the_blank": return <SelectInTheBlankExercise exercise={exercise} />;
        case "matching": return <MatchingExercise exercise={exercise} />;
        case "organize": return <OrganizeExercise exercise={exercise} />;
        case "translate": return <TranslateExercise exercise={exercise} />;
        case "true_false": return <TrueFalseExercise exercise={exercise} />;
        case "speaking": return <SpeakingExercise exercise={exercise} />;
        case "conversation": return <ConversationExercise exercise={exercise} />;
        case "quizz": return <QuizzExercise exercise={exercise} />;
        default: return null;
    }
}
