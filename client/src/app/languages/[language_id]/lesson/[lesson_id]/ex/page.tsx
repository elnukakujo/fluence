import { getExercisesByLesson } from "@/api/exercise";
import NavButton from "@/components/layout/navButton";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import Exercise from "@/interface/features/Exercise";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LessonItems, { SelectAllRow, SelectBox, SelectToggle } from "@/components/elements/itemSelection";
import { getLessonById } from "@/api/lesson";
import { getCurrentUserId } from "@/utils/user_cookie";
import { getTranslations } from "next-intl/server";

export default async function ExercisesPage({ params }: { params: Promise<{ language_id: string, lesson_id: string }> }){
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;

    const lesson = await getLessonById(lesson_id);
    const userId = await getCurrentUserId();
    const exercises: Exercise[] = await getExercisesByLesson(lesson_id)
    const exercisesByType = exercises.reduce((group, exercise) => {
        const key = exercise.exercise_type || "unknown";
        if (!group[key]) {
            group[key] = [];
        }
        group[key].push(exercise);
        return group;
    }, {} as Record<string, Exercise[]>);

    return(
        <main className="flex flex-col space-y-5">
            <h1>{t("exercises")}</h1>
            <LessonItems isOwner={userId === lesson.user_id} userId={userId ?? ""} lessonId={lesson_id} languageId={language_id} className="flex flex-col space-y-4">
                {exercises.length > 0 && <div className="flex flex-col items-start gap-2"><SelectToggle kind="ex" /><div className="w-full max-w-sm"><SelectAllRow kind="ex" entries={exercises.map((e) => [e.id!, e.exercise_type ?? "exercise"])} /></div></div>}
                {Object.entries(exercisesByType).map(([type, exercises]) => (
                    <section key={type}>
                        <h3>{type.charAt(0).toUpperCase() + type.slice(1)}</h3>
                        <ul className="list-none">
                            {exercises.map((exercise, index) => (
                                <li key={index} className="card flex flex-col gap-2">
                                    <SelectBox kind="ex" id={exercise.id!} label={exercise.exercise_type ?? "exercise"}>{exercise.exercise_type}</SelectBox>
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
                                    <p>{t("score", { score: exercise.score?.toFixed(2) })}</p>
                                    <p>{t("difficulty", { difficulty: exercise.difficulty?.toFixed(1) })}</p>
                                    <nav className="flex flex-row space-x-2">
                                        <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/ex/${exercise.id}`}>
                                            <p>{t("practiceThisExercise")}</p>
                                        </NavButton>
                                        <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/ex/${exercise.id}/update`}>
                                            <p>{t("updateExerciseButton")}</p>
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