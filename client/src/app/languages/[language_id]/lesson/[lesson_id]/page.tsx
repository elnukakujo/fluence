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
import LessonItems from "@/components/elements/itemSelection";
import { getTranslations } from "next-intl/server";
import { queueHref } from "@/api/review";


export default async function Lesson({ params }: { params: Promise<{ language_id: string, lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;
    const lesson: Lesson = await getLessonById(lesson_id);
    const userId = await getCurrentUserId();
    const isOwner = userId === lesson.user_id;

    const vocabularies: Vocabulary[] = await getVocabularyByLesson(lesson_id);
    const grammars: Grammar[] = await getGrammarByLesson(lesson_id);
    const calligraphies: Calligraphy[] =  await getCalligraphyByLesson(lesson_id);
    const exercises: Exercise[] = await getExercisesByLesson(lesson_id);

    const base = `/languages/${language_id}/lesson/${lesson_id}`;
    return (
        <main className="flex flex-col gap-6">
            <LessonHeaderCard lesson={lesson} counts={{ voc: vocabularies.length, gram: grammars.length, call: calligraphies.length, ex: exercises.length }}>
                <nav aria-label={t("studyActions")} className="flex flex-wrap gap-2">
                    <NavButton path={queueHref(language_id, { scope: "lesson", lesson_id })} className="btn btn-primary min-h-11">
                        <p>{t("reviewLesson")}</p>
                    </NavButton>
                    <NavButton path={`/languages/${language_id}`}>
                        <p>{t("backToLanguage")}</p>
                    </NavButton>
                </nav>
            </LessonHeaderCard>
            <div className="dash-grid">
                <LessonItems isOwner={isOwner} userId={userId ?? ""} lessonId={lesson_id} languageId={language_id} className="grid min-w-0 items-start gap-4 md:grid-cols-2">
                    <VocabularyList vocProps={vocabularies} />
                    <GrammarList gramProps={grammars} />
                    <CalligraphyList callProps={calligraphies} />
                    <ExerciseList exProps={exercises} isOwner={isOwner} />
                </LessonItems>
                <aside className="dash-aside">
                    <ElementPerformanceCard element={lesson} />
                    <ElementTagsCard element={lesson} />
                    <ElementSourcesCard element={lesson} />
                    <section className="card flex flex-col gap-3" aria-labelledby="manage-title">
                        <h2 id="manage-title" className="section-title">{t("manage")}</h2>
                        <div className="flex flex-wrap gap-2">
                            <NavButton path={`${base}/update`}>
                                <p>{t("updateLessonInformations")}</p>
                            </NavButton>
                            <ImportButton languageId={language_id} lessonId={lesson_id} settingsHref={`/user/${userId}/update`} />
                            {isOwner && <CollaborateButton targetType="lesson" targetId={lesson_id} />}
                            {isOwner ? (
                                <DeleteButton element_id={lesson_id}>
                                    <p>{t("deleteLessonButton")}</p>
                                </DeleteButton>
                            ) : (
                                <StopSharingButton lesson_id={lesson_id} />
                            )}
                        </div>
                    </section>
                </aside>
            </div>
        </main>
    );
}
