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
import ReadingExercise from "./readingExercise";
import DictationExercise from "./dictationExercise";

/** Renders a single exercise with its interactive component, by type. */
/** `lang` is the BCP-47 code of the practiced language, for the browser voice. */
export default function ExerciseRunner({ exercise, lang }: { exercise: Exercise; lang?: string }) {
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
        case "reading": return <ReadingExercise exercise={exercise} lang={lang} />;
        case "dictation": return <DictationExercise exercise={exercise} lang={lang} />;
        default: return null;
    }
}
