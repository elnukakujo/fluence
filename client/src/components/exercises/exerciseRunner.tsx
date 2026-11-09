"use client";

import type { ExerciseRunnerProps } from "./exerciseFinish";
import CorrectAnswer from "./correctAnswer";
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
export default function ExerciseRunner({ exercise, onFinished, gaveUp = false }: ExerciseRunnerProps) {
    const body = render(exercise, onFinished);
    if (!gaveUp) return body;
    // gave up: inputs locked (a disabled fieldset disables everything inside), solution shown
    return <><fieldset disabled className="contents">{body}</fieldset><CorrectAnswer exercise={exercise} /></>;
}

function render(exercise: ExerciseRunnerProps["exercise"], onFinished?: () => void) {
    switch (exercise.exercise_type) {
        case "essay": return <EssayExercise exercise={exercise} onFinished={onFinished} />;
        case "answering": return <AnsweringExercise exercise={exercise} onFinished={onFinished} />;
        case "type_in_the_blank": return <TypeInTheBlankExercise exercise={exercise} onFinished={onFinished} />;
        case "select_in_the_blank": return <SelectInTheBlankExercise exercise={exercise} onFinished={onFinished} />;
        case "matching": return <MatchingExercise exercise={exercise} onFinished={onFinished} />;
        case "organize": return <OrganizeExercise exercise={exercise} onFinished={onFinished} />;
        case "translate": return <TranslateExercise exercise={exercise} onFinished={onFinished} />;
        case "true_false": return <TrueFalseExercise exercise={exercise} onFinished={onFinished} />;
        case "speaking": return <SpeakingExercise exercise={exercise} onFinished={onFinished} />;
        case "conversation": return <ConversationExercise exercise={exercise} onFinished={onFinished} />;
        case "quizz": return <QuizzExercise exercise={exercise} onFinished={onFinished} />;
        case "reading": return <ReadingExercise exercise={exercise} onFinished={onFinished} />;
        case "dictation": return <DictationExercise exercise={exercise} onFinished={onFinished} />;
        default: return null;
    }
}
