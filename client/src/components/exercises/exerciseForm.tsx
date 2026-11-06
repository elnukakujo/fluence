"use client";

import { getExamCategories, suggestCategory } from "@/utils/language_iso639";
import { categoryLabel } from "@/utils/groupByCategory";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import SubmitButton from "@/components/ui/buttons/submitButton";
import { useRouter } from "next/navigation";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import OpenCloseMenu from "@/components/ui/selectMenu/openCloseMenu";
import TagSelector from "@/components/tags/tagSelector";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import TrueFalseInput from "@/components/exercises/trueFalseInput";
import MediaLoader from "@/components/media/mediaLoader";
import { createExercise, updateExercise } from "@/api/exercise";
import ConversationInput from "@/components/exercises/conversationInput";
import type Calligraphy from "@/interface/features/Calligraphy";
import type Grammar from "@/interface/features/Grammar";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Exercise from "@/interface/features/Exercise";
import type { ExerciseContent } from "@/interface/features/Exercise";
import SourceSelector from "@/components/sources/sourceSelector";
import { type ReadingRow, type DictationRow, readingContent, readingRows, dictationContent, dictationRows } from "./readingDictationRows";
import {
    type BlankRow, BlankContentEditor, QuizzContentEditor, MatchingContentEditor, ReadingContentEditor, DictationContentEditor, OrganizeContentEditor,
} from "./contentEditors";

const STRUCTURED_TYPES: NonNullable<Exercise["exercise_type"]>[] = [
    "type_in_the_blank", "select_in_the_blank", "matching", "organize", "true_false", "quizz",
];

export interface LessonElements {
    vocabularies: Vocabulary[];
    grammars: Grammar[];
    calligraphies: Calligraphy[];
}

const EXERCISE_TYPE_OPTIONS: NonNullable<Exercise["exercise_type"]>[] = [
    "translate",
    "type_in_the_blank",
    "select_in_the_blank",
    "essay",
    "true_false",
    "organize",
    "answering",
    "matching",
    "speaking",
    "conversation",
    "quizz",
    "reading",
    "dictation",
];

export default function ExerciseForm({
    exercise,
    lesson_id,
    lessonElements,
    languageIso,
}: {
    exercise?: Exercise | Partial<Exercise>;
    lesson_id: string;
    lessonElements: LessonElements;
    languageIso?: string;   // target language (ISO 639-2T): picks the exam sections offered as categories
}) {
    const t = useTranslations("exercises");
    const router = useRouter();
    const isUpdate = Boolean(exercise?.id);

    let exerciseData: Partial<Exercise>;
    if (!exercise) {
        exerciseData = {
            exercise_type: undefined,
            question: "",
            answer: "",
            text_support: "",
            image_files: [],
            audio_files: [],
            related_vocabulary: [],
            related_grammar: [],
            related_calligraphy: [],
            lesson_id,
        };
    } else {
        exerciseData = exercise;
    }

    const [exerciseType, setExerciseType] = useState<Exercise["exercise_type"]>(exerciseData.exercise_type);
    const categories = getExamCategories(languageIso);
    const [category, setCategory] = useState<string>(exerciseData.category || "");
    const [categoryTouched, setCategoryTouched] = useState(false);
    const [question, setQuestion] = useState<string>(exerciseData.question || "");
    const [answer, setAnswer] = useState<string>(exerciseData.answer || "");
    const [supportText, setSupportText] = useState<string>(exerciseData.text_support || "");

    const [imageUrl, setImageUrl] = useState<string[]>(exerciseData.image_files ?? []);
    const [audioUrl, setAudioUrl] = useState<string[]>(exerciseData.audio_files ?? []);

    const [relatedVocabularies, setRelatedVocabularies] = useState<string[]>(exerciseData.related_vocabulary ?? []);
    const [relatedCalligraphies, setRelatedCalligraphies] = useState<string[]>(exerciseData.related_calligraphy ?? []);
    const [relatedGrammars, setRelatedGrammars] = useState<string[]>(exerciseData.related_grammar ?? []);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(exerciseData.tags ? exerciseData.tags.map(tag => tag.id!) : []);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(exerciseData.sources ? exerciseData.sources.map(source => source.id!) : []);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Structured content state (type_in_the_blank, select_in_the_blank, matching, organize, true_false) ──
    const existingContent = exerciseData.content;
    const [segments, setSegments] = useState<string[]>(
        existingContent && "segments" in existingContent ? existingContent.segments : ["", ""]
    );
    const [blanks, setBlanks] = useState<BlankRow[]>(
        existingContent && "blanks" in existingContent
            ? existingContent.blanks.map(b => ({ answer: b.answer, options: (b.options ?? []).join(", ") }))
            : [{ answer: "", options: "" }]
    );
    const [pairs, setPairs] = useState<[string, string][]>(
        existingContent && "pairs" in existingContent ? existingContent.pairs : [["", ""]]
    );
    const [organizeItems, setOrganizeItems] = useState<string[]>(
        existingContent && "items" in existingContent ? existingContent.items : ["", ""]
    );
    const [tfStatement, setTfStatement] = useState<string>(
        existingContent && "statement" in existingContent ? existingContent.statement : ""
    );
    const [tfAnswer, setTfAnswer] = useState<boolean>(
        existingContent && "answer" in existingContent && typeof existingContent.answer === "boolean" ? existingContent.answer : true
    );
    const [quizOptions, setQuizOptions] = useState<string[]>(
        existingContent && "options" in existingContent ? existingContent.options : ["", ""]
    );
    const [quizCorrect, setQuizCorrect] = useState<number[]>(
        existingContent && "correct" in existingContent ? existingContent.correct : []
    );

    const [readingLines, setReadingLines] = useState<ReadingRow[]>(readingRows(existingContent));
    const [dictationLines, setDictationLines] = useState<DictationRow[]>(dictationRows(existingContent));

    useEffect(() => {
        switch (exerciseType) {
            case "translate":
                if (isUpdate) break;
                setQuestion("A sentence to translate");
                setSupportText("");
                setAnswer("The translation");
                break;
            case "type_in_the_blank":
                if (isUpdate) {
                    const questionParts = question.split('__');
                    const correctAnswers = questionParts.slice(0, -1).map((part, index) => {
                        const nextPart = questionParts[index + 1] || "";
                        const start = answer.indexOf(part) + part.length;
                        const end = nextPart ? answer.indexOf(nextPart, start) : answer.length;

                        if (start < part.length || end < start) {
                            return "";
                        }

                        return answer.slice(start, end).trim();
                    }).filter(Boolean);
                    setAnswer(
                        correctAnswers.join('__')
                    )
                    break;
                }
                setQuestion("The house is __ and __.");
                setSupportText("");
                setAnswer("big__small");
                break;
            case "select_in_the_blank":
                if (isUpdate) break;
                setQuestion("The house is __ and __.");
                setSupportText("");
                setAnswer("big__small");
                break;
            case "essay":
                if (isUpdate) break;
                setQuestion("Write here some requirements about the essay, and details");
                setSupportText("");
                setAnswer("Some helps and tips to write the essay");
                break;
            case "true_false":
                if (isUpdate) break;
                setQuestion("A statement to evaluate");
                setSupportText("");
                setAnswer("true");
                break;
            case "quizz":
                if (isUpdate) break;
                setQuestion("A question with one or more correct options");
                setSupportText("");
                setAnswer("");
                break;
            case "answering":
                if (isUpdate) break;
                setQuestion("A question to answer");
                setSupportText("");
                setAnswer("The answer to the question");
                break;
            case "speaking":
                if (isUpdate) break;
                setQuestion("A sentence to speak");
                setSupportText("");
                setAnswer("");
                break;
            default:
                if (isUpdate) break;
                setQuestion("");
                setSupportText("");
                setAnswer("");
                break;
        }
    }, [exerciseType, isUpdate]);

    const isLines = exerciseType === "reading" || exerciseType === "dictation";   // the lines are the content; the question is an optional instruction

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const currentPath = window.location.pathname;
        const pathParts = currentPath.split("/");
        const languageId = pathParts[2];

        let normalizedQuestion: string = question;
        let normalizedAnswer: string = answer;
        let content: ExerciseContent | undefined;

        if (exerciseType === "type_in_the_blank" || exerciseType === "select_in_the_blank") {
            content = {
                segments,
                blanks: blanks.map(b => ({
                    answer: b.answer,
                    ...(b.options.trim() ? { options: b.options.split(",").map(o => o.trim()).filter(Boolean) } : {}),
                })),
            };
            normalizedQuestion = segments.join("__");
            normalizedAnswer = blanks.map(b => b.answer).join(", ");
        } else if (exerciseType === "matching") {
            content = { pairs };
            normalizedQuestion = "Matching exercise";
            normalizedAnswer = pairs.map(p => p.join(" - ")).join("; ");
        } else if (exerciseType === "organize") {
            content = { items: organizeItems, answer_order: organizeItems.map((_, i) => i) };
            normalizedQuestion = organizeItems.join(" ");
            normalizedAnswer = organizeItems.join(" ");
        } else if (exerciseType === "true_false") {
            content = { statement: tfStatement, answer: tfAnswer };
            normalizedQuestion = tfStatement;
            normalizedAnswer = String(tfAnswer);
        } else if (exerciseType === "quizz") {
            content = { options: quizOptions, correct: quizCorrect };
            normalizedAnswer = quizCorrect.map(i => quizOptions[i]).join(", ");
        } else if (exerciseType === "reading") {
            content = readingContent(readingLines);
            normalizedAnswer = content.lines.map(l => l.text).join("\n");
            if (!normalizedQuestion.trim()) normalizedQuestion = content.lines[0].text.slice(0, 60);   // the question column is required
        } else if (exerciseType === "dictation") {
            content = dictationContent(dictationLines);
            normalizedAnswer = content.lines.map(l => l.text).join(" ");
            if (!normalizedQuestion.trim()) normalizedQuestion = content.lines[0].text.slice(0, 60);
        } else if (exerciseType === "speaking") {
            normalizedAnswer = normalizedQuestion;
        }

        const element: Partial<Exercise> = {
            exercise_type: exerciseType,
            question: normalizedQuestion,
            text_support: supportText || undefined,
            image_files: imageUrl,
            audio_files: audioUrl,
            answer: normalizedAnswer,
            content,
            category: category || null,
            lesson_id,
            related_vocabulary: relatedVocabularies,
            related_grammar: relatedGrammars,
            related_calligraphy: relatedCalligraphies,
            tags: selectedTagIds.map(id => ({ id })),
            sources: selectedSourceIds.map(id => ({ id }))
        };

        if (exerciseType === "speaking" && audioUrl.length === 0) {
            alert(t("speakingNeedsAudio"));
            return;
        }

        setIsSubmitting(true);
        try {
            let exerciseId: string;
            if (isUpdate) {
                await updateExercise(exerciseData.id!, element);
                exerciseId = exerciseData.id!;
                router.push(`/languages/${languageId}/lesson/${lesson_id}/ex/${exerciseData.id}/`);
            } else {
                const response = await createExercise(element);
                exerciseId = response.id;
                router.push(`/languages/${languageId}/lesson/${lesson_id}`);
            }

            router.refresh();
        } catch (error) {
            console.error(`Failed to ${isUpdate ? "update" : "create"} exercise:`, error);
            alert(t(isUpdate ? "failedUpdate" : "failedCreate"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="flex flex-col space-y-4 items-center min-w-[40rem]" onSubmit={handleSubmit}>
            <ClassicSelectMenu
                label={t("exerciseType")}
                options={EXERCISE_TYPE_OPTIONS}
                optionLabel={(v) => (EXERCISE_TYPE_KEY[v] ? t(EXERCISE_TYPE_KEY[v]) : undefined)}
                selectedOption={exerciseType || ""}
                onChange={(value) => {
                    setExerciseType(value as Exercise["exercise_type"]);
                    // a new exercise starts with the exam section its type usually belongs to, until the user picks one
                    if (!isUpdate && !categoryTouched) setCategory(suggestCategory(value as string, categories) ?? "");
                }}
                required
            />
            <label className="flex w-full flex-col gap-1 text-sm">
                {t("categoryLabel")}
                <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setCategoryTouched(true); }}>
                    <option value="">{t("categoryNone")}</option>
                    {category && !categories.some((c) => c.slug === category) && <option value={category}>{category}</option>}
                    {categories.map((c) => <option key={c.slug} value={c.slug}>{categoryLabel(t, c.slug)}{c.nativeLabel ? ` · ${c.nativeLabel}` : ""}</option>)}
                </select>
            </label>

            {exerciseType !== undefined && (
                <>
                    {!["matching", "organize", "conversation", ...STRUCTURED_TYPES.filter(t => t !== "quizz")].includes(exerciseType) && (
                        <AutoSizeTextArea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            className="card flex w-full overflow-hidden p-2"
                            label={t(isLines ? "instructionOptional" : "questionLabel")}
                            required={!isLines}
                        />
                    )}

                    <AutoSizeTextArea
                        value={supportText}
                        onChange={(e) => setSupportText(e.target.value)}
                        className="card flex w-full overflow-hidden p-2"
                        label={t("support")}
                    />

                    {exerciseType === "reading" && <ReadingContentEditor rows={readingLines} setRows={setReadingLines} />}

                    {exerciseType === "dictation" && <DictationContentEditor rows={dictationLines} setRows={setDictationLines} />}

                    <MediaLoader imageUrl={imageUrl} setImageUrl={setImageUrl} audioUrl={audioUrl} setAudioUrl={setAudioUrl} />

                    {exerciseType === "conversation" && (
                        <ConversationInput
                            value={question || undefined}   // question stores the full JSON
                            totalAudioSlots={audioUrl.length}
                            onChange={({ question: q, answer: a }) => {
                                setQuestion(q);
                                setAnswer(a);
                            }}
                        />
                    )}

                    {exerciseType === "true_false" && (
                        <>
                            <AutoSizeTextArea
                                value={tfStatement}
                                onChange={(e) => setTfStatement(e.target.value)}
                                className="card flex w-full overflow-hidden p-2"
                                label={t("statement")}
                                required
                            />
                            <TrueFalseInput
                                value={tfAnswer}
                                onChange={(e) => setTfAnswer(e.target.value === "true")}
                                label={t("answer")}
                            />
                        </>
                    )}

                    {(exerciseType === "type_in_the_blank" || exerciseType === "select_in_the_blank") && (
                        <BlankContentEditor
                            hasOptions={exerciseType === "select_in_the_blank"}
                            segments={segments}
                            setSegments={setSegments}
                            blanks={blanks}
                            setBlanks={setBlanks}
                        />
                    )}

                    {exerciseType === "matching" && (
                        <MatchingContentEditor pairs={pairs} setPairs={setPairs} />
                    )}

                    {exerciseType === "organize" && (
                        <OrganizeContentEditor items={organizeItems} setItems={setOrganizeItems} />
                    )}

                    {exerciseType === "quizz" && (
                        <QuizzContentEditor options={quizOptions} setOptions={setQuizOptions} correct={quizCorrect} setCorrect={setQuizCorrect} />
                    )}

                    {!["true_false", "matching", "organize", "speaking", "type_in_the_blank", "select_in_the_blank", "conversation", "quizz", "reading", "dictation"].includes(exerciseType) && (
                        <AutoSizeTextArea
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            label={t("answer")}
                            required
                        />
                    )}

                    <section className="flex flex-col space-y-4 w-full items-baseline">
                        <OpenCloseMenu
                            elements={lessonElements.vocabularies.map((item) => ({
                                id: item.id!,
                                value: item.word.word + " - " + item.word.translation,
                            }))}
                            selectedElements={relatedVocabularies}
                            setSelectedElements={setRelatedVocabularies}
                            label={t("associatedVocabulary")}
                        />
                        <OpenCloseMenu
                            elements={lessonElements.grammars.map((item) => ({ id: item.id!, value: item.title }))}
                            selectedElements={relatedGrammars}
                            setSelectedElements={setRelatedGrammars}
                            label={t("associatedGrammar")}
                        />
                        <OpenCloseMenu
                            elements={lessonElements.calligraphies.map((item) => ({
                                id: item.id!,
                                value: item.character.character + " - " + item.character.phonetic,
                            }))}
                            selectedElements={relatedCalligraphies}
                            setSelectedElements={setRelatedCalligraphies}
                            label={t("associatedCalligraphies")}
                        />
                    </section>

                    <TagSelector
                        selectedTagIds={selectedTagIds}
                        onTagsChange={setSelectedTagIds}
                        elementId={exerciseData.id!}
                    />

                    <SourceSelector
                        selectedSourceIds={selectedSourceIds}
                        onSourcesChange={setSelectedSourceIds}
                        elementId={exerciseData.id!}
                    />

                    {isUpdate ? <SubmitButton isLoading={isSubmitting}>{t("updateExercise")}</SubmitButton> : <SubmitButton isLoading={isSubmitting}>{t("addExercise")}</SubmitButton>}
                </>
            )}
        </form>
    );
}