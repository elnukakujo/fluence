import type { ComponentType } from "react";
import typeMeta from "@/shared/exercise-types.json";
import type { ExerciseRunnerProps } from "./exerciseFinish";

import AnsweringExercise from "./answeringExercise";
import ConversationExercise from "./conversationExercise";
import DictationExercise from "./dictationExercise";
import EssayExercise from "./essayExercise";
import MatchingExercise from "./matchingExercise";
import OrganizeExercise from "./organizeExercise";
import QuizzExercise from "./quizzExercise";
import ReadingExercise from "./readingExercise";
import SelectInTheBlankExercise from "./selectInTheBlankExercise";
import SpeakingExercise from "./speakingExercise";
import TranslateExercise from "./translateExercise";
import TrueFalseExercise from "./trueFalseExercise";
import TypeInTheBlankExercise from "./typeInTheBlankExercise";

export type ExerciseTypeInfo = {
    name: string;
    i18nKey: string;
    category: string;
    Runner: ComponentType<Omit<ExerciseRunnerProps, "gaveUp">>;
    Editor?: ComponentType<never>; // slot: the per-type editors take heterogeneous props, un-wired today
    skills?: readonly string[];    // slot for the target domain, unread today
};

const RUNNERS: Record<string, ExerciseTypeInfo["Runner"]> = {
    essay: EssayExercise, answering: AnsweringExercise, type_in_the_blank: TypeInTheBlankExercise,
    select_in_the_blank: SelectInTheBlankExercise, matching: MatchingExercise, organize: OrganizeExercise,
    translate: TranslateExercise, true_false: TrueFalseExercise, speaking: SpeakingExercise,
    conversation: ConversationExercise, quizz: QuizzExercise, reading: ReadingExercise, dictation: DictationExercise,
};

// name / i18nKey / category come from shared/exercise-types.json (single source with the server registry);
// Runner is the one per-side bit that cannot live in JSON.
export const EXERCISE_TYPES: readonly ExerciseTypeInfo[] = typeMeta.map((t) => ({
    name: t.name, i18nKey: t.i18nKey, category: t.category, Runner: RUNNERS[t.name],
}));

export function exerciseTypeInfo(name: string | undefined): ExerciseTypeInfo | undefined {
    return EXERCISE_TYPES.find((t) => t.name === name);
}
