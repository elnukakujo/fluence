import NavButton from "@/components/layout/navButton";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import Exercise from "@/interface/features/Exercise";

import TypeInTheBlankExercise from "@/components/exercises/typeInTheBlankExercise";
import SelectInTheBlankExercise from "@/components/exercises/selectInTheBlankExercise";
import TranslateExercise from "@/components/exercises/translateExercise";
import EssayExercise from "@/components/exercises/essayExercise";
import TrueFalseExercise from "@/components/exercises/trueFalseExercise";
import OrganizeExercise from "@/components/exercises/organizeExercise";
import AnsweringExercise from "@/components/exercises/answeringExercise";
import MatchingExercise from "@/components/exercises/matchingExercise";
import SpeakingExercise from "@/components/exercises/speakingExercise";
import BackButton from "@/components/ui/buttons/backButton";
import ConversationExercise from "@/components/exercises/conversationExercise";
import QuizzExercise from "@/components/exercises/quizzExercise";
import ReadingExercise from "@/components/exercises/readingExercise";
import DictationExercise from "@/components/exercises/dictationExercise";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import NeedsBadge from "@/components/exercises/needsBadge";
import GenerateAudioButton from "@/components/exercises/generateAudioButton";
import { getExerciseById } from "@/api/exercise";
import { getTranslations } from "next-intl/server";

export default async function ExercisePage( { params } : { params: Promise<{ language_id: string; lesson_id: string; ex_id: string }>}) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id, ex_id } = await params;

    const exercise: Exercise = await getExerciseById(ex_id);

    return(
        <main className="flex flex-col space-y-4">
            {exercise.exercise_type === 'type_in_the_blank' && (
                <TypeInTheBlankExercise exercise={exercise} />
            )}
            {exercise.exercise_type === 'select_in_the_blank' && (
                <SelectInTheBlankExercise exercise={exercise} />
            )}
            {exercise.exercise_type === 'translate' && (
                <TranslateExercise exercise={ exercise } />
            )}
            {exercise.exercise_type === 'essay' && (
                <EssayExercise exercise={ exercise } />
            )}
            {exercise.exercise_type === 'true_false' && (
                <TrueFalseExercise exercise={ exercise } />
            )}
            {exercise.exercise_type === 'organize' && (
                <OrganizeExercise exercise={ exercise } />
            )}
            {exercise.exercise_type === 'answering' && (
                <AnsweringExercise exercise={ exercise } />
            )}
            {exercise.exercise_type === 'matching' && (
                <MatchingExercise exercise={ exercise } />
            )}
            {exercise.exercise_type === 'speaking' && (
                <SpeakingExercise exercise={ exercise } />
            )}
            {exercise.exercise_type === 'conversation' && <ConversationExercise exercise={exercise} />}
            {exercise.exercise_type === 'quizz' && <QuizzExercise exercise={exercise} />}
            <NeedsBadge exercise={exercise} />
            {exercise.exercise_type === 'reading' && <ReadingExercise exercise={exercise} />}
            {exercise.exercise_type === 'reading' && <GenerateAudioButton exercise={exercise} />}
            {exercise.exercise_type === 'dictation' && <DictationExercise exercise={exercise} />}

            <ElementTagsCard element={exercise} />
            <ElementSourcesCard element={exercise} />
            <ElementPerformanceCard element={exercise}/>

            <nav className="flex flex-row space-x-4">
                <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/ex/${exercise.id}/update`}>
                    <p>{t("updateExerciseButton")}</p>
                </NavButton>
                <DeleteButton
                    element_id={exercise.id!}
                >
                    <p>{t("deleteExerciseButton")}</p>
                </DeleteButton>
                <BackButton>
                    <p>{t("backToLesson")}</p>
                </BackButton>
            </nav>
        </main>
    )
}