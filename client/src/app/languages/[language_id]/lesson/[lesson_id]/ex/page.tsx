import { getExercisesByLesson } from "@/api/exercise";
import NavButton from "@/components/layout/navButton";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import ExerciseFilter from "@/components/exercises/exerciseFilter";
import ExerciseStatus from "@/components/exercises/exerciseStatus";
import Exercise from "@/interface/features/Exercise";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LessonItems, { SelectAllRow, SelectBox, SelectToggle } from "@/components/elements/itemSelection";
import { getLessonById } from "@/api/lesson";
import { getLanguageById } from "@/api/language";
import { categoryOf, getExamCategories } from "@/utils/language_iso639";
import { categoryLabel, groupByCategory } from "@/utils/groupByCategory";
import { getCurrentUserId } from "@/utils/user_cookie";
import { Play, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function ExercisesPage({ params, searchParams }: { params: Promise<{ language_id: string, lesson_id: string }>, searchParams: Promise<{ type?: string, status?: string, category?: string }> }){
    const t = await getTranslations("languages");
    const tEx = await getTranslations("exercises");
    const { language_id, lesson_id } = await params;
    const { type: typeParam, status, category } = await searchParams;

    const lesson = await getLessonById(lesson_id);
    const userId = await getCurrentUserId();
    const categories = getExamCategories((await getLanguageById(language_id)).target_iso639_2t);
    const exercises: Exercise[] = await getExercisesByLesson(lesson_id)
    const allTypes = [...new Set(exercises.map((e) => e.exercise_type || "unknown"))].sort();
    const wanted = (typeParam ?? "").split(",").filter(Boolean);
    const shown = exercises.filter((e) =>
        (!wanted.length || wanted.includes(e.exercise_type || "unknown")) &&
        (!status || (status === "ready") === !e.needs?.length) &&
        (!category || categoryOf(e.exercise_type, categories) === category));
    const exercisesByCategory = groupByCategory(shown, categories);

    return(
        <main className="flex flex-col space-y-5">
            <h1>{t("exercises")}</h1>
            <LessonItems isOwner={userId === lesson.user_id} userId={userId ?? ""} lessonId={lesson_id} languageId={language_id} className="flex flex-col space-y-4">
                {exercises.length > 0 && <div className="flex flex-col items-start gap-2"><div className="flex flex-wrap items-center gap-2"><SelectToggle kind="ex" /><ExerciseFilter types={allTypes} categories={categories} /></div><div className="w-full max-w-sm"><SelectAllRow kind="ex" entries={shown.map((e) => [e.id!, e.exercise_type ?? "exercise"])} /></div></div>}
                {exercises.length > 0 && shown.length === 0 && <p className="text-muted">{tEx("filterNoMatch")}</p>}
                {exercisesByCategory.map(({ slug, exercises }) => (
                    <section key={slug ?? "none"}>
                        <h3>{slug ? categoryLabel(tEx, slug) : tEx("uncategorized")} <span className="text-muted">({exercises.length})</span></h3>
                        <ul className="list-none">
                            {exercises.map((exercise, index) => (
                                <li key={index} className="card ex-card">
                                    <div className="ex-card-head">
                                        <SelectBox kind="ex" id={exercise.id!} label={exercise.exercise_type ?? "exercise"}>{exercise.exercise_type}</SelectBox>
                                        <ExerciseStatus exercise={exercise} />
                                    </div>
                                    {!['type_in_the_blank', 'select_in_the_blank', 'conversation'].includes(exercise.exercise_type!) && (
                                        <Markdown remarkPlugins={[remarkGfm]}>{exercise.question}</Markdown>
                                    )}
                                    {['type_in_the_blank', 'select_in_the_blank'].includes(exercise.exercise_type!) && (
                                        <span className="flex flex-row gap-2">
                                            {
                                                exercise.question.split('\n\n').map((part, idx) => (
                                                    <p
                                                        key={idx}
                                                    >
                                                        {part === '__' ? <span className="underline">{t("blankField")}</span> : part}
                                                    </p>
                                                ))
                                            }
                                        </span>
                                    )}
                                    {exercise.exercise_type === 'conversation' && (() => {
                                        const lines: {speakerId: string}[] = JSON.parse(exercise.question).lines;
                                        const speakers: {id: string, name: string, isUser: boolean}[] = JSON.parse(exercise.question).speakers;

                                        const userId = speakers.filter((speaker) => speaker.isUser)[0]?.id;
                                        const userLines = lines.filter((line) => line.speakerId === userId);
                                        return (
                                            <span className="flex flex-col">
                                                <p>{t("totalExchanges", { count: lines.length })}</p>
                                                <p>{t("userLines", { count: userLines.length })}</p>
                                                <p>{t("uniqueSpeakers", { count: speakers.length })}</p>
                                            </span>
                                        );
                                    })()}
                                    <div className="ex-stats">
                                        <span>{t("score", { score: exercise.score?.toFixed(2) })}</span>
                                        <span>{t("difficulty", { difficulty: exercise.difficulty?.toFixed(1) })}</span>
                                    </div>
                                    <nav className="ex-actions">
                                        <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/ex/${exercise.id}`}>
                                            <span className="inline-flex items-center gap-2"><Play size={14} aria-hidden />{t("practiceThisExercise")}</span>
                                        </NavButton>
                                        <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/ex/${exercise.id}/update`}>
                                            <span className="inline-flex items-center gap-2"><Pencil size={14} aria-hidden />{t("updateExerciseButton")}</span>
                                        </NavButton>
                                        <DeleteButton element_id={exercise.id!}>
                                            <p>{t("deleteExerciseButton")}</p>
                                        </DeleteButton>
                                    </nav>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </LessonItems>
            <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/ex/new`}>
                <p>{t("addNewExercise")}</p>
            </NavButton>
        </main>
    )
}