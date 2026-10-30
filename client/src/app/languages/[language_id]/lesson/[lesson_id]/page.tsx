import VocabularyList from "@/components/elements/vocabularyList";
import GrammarList from "@/components/elements/grammarList";
import CalligraphyList from "@/components/elements/calligraphyList";
import ExerciseList from "@/components/exercises/exerciseList";

import type Lesson from "@/interface/containers/Lesson";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import type Exercise from "@/interface/features/Exercise";

import NavButton from "@/components/layout/navButton";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import StopSharingButton from "@/components/ui/buttons/stopSharingButton";
import CollaborateButton from "@/components/collaboration/collaborateButton";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import { getLessonById } from "@/api/lesson";
import { getVocabularyByLesson } from "@/api/vocabulary";
import { getGrammarByLesson } from "@/api/grammar";
import { getCalligraphyByLesson } from "@/api/calligraphy";
import { getExercisesByLesson } from "@/api/exercise";
import LessonHeaderCard from "@/components/lesson/lessonHeaderCard";
import { getCurrentUserId } from "@/utils/user_cookie";
import ImportButton from "@/components/ingestion/importButton";


export default async function Lesson({ params }: { params: Promise<{ language_id: string, lesson_id: string }> }) {
    const { language_id, lesson_id } = await params;
    const lesson: Lesson = await getLessonById(lesson_id);
    const userId = await getCurrentUserId();
    const isOwner = userId === lesson.user_id;

    const vocabularies: Vocabulary[] = await getVocabularyByLesson(lesson_id);
    const grammars: Grammar[] = await getGrammarByLesson(lesson_id);
    const calligraphies: Calligraphy[] =  await getCalligraphyByLesson(lesson_id);
    const exercises: Exercise[] = await getExercisesByLesson(lesson_id);

    return (
        <main className="flex flex-col gap-8">
            <header className="flex flex-col gap-4">
                <LessonHeaderCard lesson={lesson} />
                <ElementPerformanceCard element={lesson} />
                <ElementTagsCard element={lesson} />
                <ElementSourcesCard element={lesson} />
                <nav className="flex flex-row flex-wrap gap-2">
                    <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/update`}>
                        <p>Update this Lesson Informations</p>
                    </NavButton>
                    <ImportButton languageId={language_id} lessonId={lesson_id} settingsHref={`/user/${userId}/update`} />
                    {isOwner && <CollaborateButton targetType="lesson" targetId={lesson_id} />}
                    {isOwner ? (
                        <DeleteButton element_id={lesson_id}>
                            <p>Delete this Lesson</p>
                        </DeleteButton>
                    ) : (
                        <StopSharingButton lesson_id={lesson_id} />
                    )}
                </nav>
            </header>
            <article className="flex flex-row flex-wrap gap-8 justify-around">
                <VocabularyList vocProps={vocabularies} />
                <GrammarList gramProps={grammars} />
                <CalligraphyList callProps={calligraphies} />
                <ExerciseList exProps={exercises} />
            </article>
        </main>
    );
}
