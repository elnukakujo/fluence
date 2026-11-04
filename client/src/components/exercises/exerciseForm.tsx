"use client";

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

const STRUCTURED_TYPES: NonNullable<Exercise["exercise_type"]>[] = [
    "type_in_the_blank", "select_in_the_blank", "matching", "organize", "true_false", "quizz",
];

type BlankRow = { answer: string; options: string }; // options: comma-separated

// Appends/strips a trailing "\n" on a segment, rendered as a horizontal divider in the practice card.
function toggleLineBreak(value: string): string {
    return value.endsWith("\n") ? value.slice(0, -1) : value + "\n";
}

function SegmentInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    const t = useTranslations("exercises");
    const hasBreak = value.endsWith("\n");
    return (
        <div className="flex items-center gap-2">
            <input
                className="input flex-1"
                placeholder={placeholder}
                value={hasBreak ? value.slice(0, -1) : value}
                onChange={(e) => onChange(hasBreak ? e.target.value + "\n" : e.target.value)}
            />
            <button
                type="button"
                className={`chip ${hasBreak ? 'bg-accent text-primary-foreground' : ''}`}
                title={t("lineBreakTitle")}
                onClick={() => onChange(toggleLineBreak(value))}
            >
                ⏎
            </button>
        </div>
    );
}

// Builds the content object + a human-readable question/answer pair for the structured types.
function BlankContentEditor({
    hasOptions,
    segments, setSegments,
    blanks, setBlanks,
}: {
    hasOptions: boolean;
    segments: string[]; setSegments: (v: string[]) => void;
    blanks: BlankRow[]; setBlanks: (v: BlankRow[]) => void;
}) {
    const t = useTranslations("exercises");
    const addBlank = () => {
        setBlanks([...blanks, { answer: "", options: "" }]);
        setSegments([...segments, ""]);
    };
    const removeBlank = (i: number) => {
        setBlanks(blanks.filter((_, idx) => idx !== i));
        setSegments(segments.filter((_, idx) => idx !== i + 1));
    };
    return (
        <fieldset className="card flex flex-col gap-3 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("sentenceWithBlanks")}</legend>
            <SegmentInput
                placeholder={t("textBeforeFirstBlank")}
                value={segments[0] ?? ""}
                onChange={(v) => setSegments([v, ...segments.slice(1)])}
            />
            {blanks.map((blank, i) => (
                <div key={i} className="flex flex-col gap-2 border-t border-dashed border-border pt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge">{t("blankN", { n: i + 1 })}</span>
                        <input
                            className="input w-fit"
                            placeholder={t("answer")}
                            value={blank.answer}
                            onChange={(e) => setBlanks(blanks.map((b, idx) => idx === i ? { ...b, answer: e.target.value } : b))}
                            required
                        />
                        {hasOptions && (
                            <input
                                className="input"
                                placeholder={t("options")}
                                value={blank.options}
                                onChange={(e) => setBlanks(blanks.map((b, idx) => idx === i ? { ...b, options: e.target.value } : b))}
                            />
                        )}
                        <button type="button" className="chip-remove" onClick={() => removeBlank(i)}>x</button>
                    </div>
                    <SegmentInput
                        placeholder={t("textAfterBlank")}
                        value={segments[i + 1] ?? ""}
                        onChange={(v) => setSegments(segments.map((s, idx) => idx === i + 1 ? v : s))}
                    />
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={addBlank}>{t("addBlank")}</button>
        </fieldset>
    );
}

function QuizzContentEditor({
    options, setOptions,
    correct, setCorrect,
}: {
    options: string[]; setOptions: (v: string[]) => void;
    correct: number[]; setCorrect: (v: number[]) => void;
}) {
    const t = useTranslations("exercises");
    const toggleCorrect = (i: number) => {
        setCorrect(correct.includes(i) ? correct.filter(c => c !== i) : [...correct, i]);
    };
    const removeOption = (i: number) => {
        setOptions(options.filter((_, idx) => idx !== i));
        setCorrect(correct.filter(c => c !== i).map(c => c > i ? c - 1 : c));
    };
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("optionsCheckAll")}</legend>
            {options.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={correct.includes(i)}
                        onChange={() => toggleCorrect(i)}
                    />
                    <input
                        className="input"
                        placeholder={t("optionText")}
                        value={option}
                        onChange={(e) => setOptions(options.map((o, idx) => idx === i ? e.target.value : o))}
                        required
                    />
                    {options.length > 1 && <button type="button" className="chip-remove" onClick={() => removeOption(i)}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setOptions([...options, ""])}>{t("addOption")}</button>
        </fieldset>
    );
}

function MatchingContentEditor({ pairs, setPairs }: { pairs: [string, string][]; setPairs: (v: [string, string][]) => void }) {
    const t = useTranslations("exercises");
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("pairs")}</legend>
            {pairs.map((pair, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input className="input" placeholder={t("left")} value={pair[0]} onChange={(e) => setPairs(pairs.map((p, idx) => idx === i ? [e.target.value, p[1]] : p))} required />
                    <input className="input" placeholder={t("right")} value={pair[1]} onChange={(e) => setPairs(pairs.map((p, idx) => idx === i ? [p[0], e.target.value] : p))} required />
                    {pairs.length > 1 && <button type="button" className="chip-remove" onClick={() => setPairs(pairs.filter((_, idx) => idx !== i))}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setPairs([...pairs, ["", ""]])}>{t("addPair")}</button>
        </fieldset>
    );
}

function ReadingContentEditor({ rows, setRows }: { rows: ReadingRow[]; setRows: (v: ReadingRow[]) => void }) {
    const t = useTranslations("exercises");
    const set = (i: number, patch: Partial<ReadingRow>) => setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("readingLines")}</legend>
            {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input className="input w-32" placeholder={t("speakerOptional")} value={r.speaker} onChange={(e) => set(i, { speaker: e.target.value })} />
                    <input className="input flex-1" placeholder={t("lineText")} value={r.text} onChange={(e) => set(i, { text: e.target.value })} required />
                    <input className="input flex-1" placeholder={t("translationOptional")} value={r.translation} onChange={(e) => set(i, { translation: e.target.value })} />
                    {rows.length > 1 && <button type="button" className="chip-remove" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setRows([...rows, { speaker: rows[rows.length - 1]?.speaker ?? "", text: "", translation: "", audioIndex: null }])}>{t("addLine")}</button>
        </fieldset>
    );
}

function DictationContentEditor({ rows, setRows }: { rows: DictationRow[]; setRows: (v: DictationRow[]) => void }) {
    const t = useTranslations("exercises");
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("dictationLines")}</legend>
            {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input className="input" placeholder={t("lineText")} value={r.text} onChange={(e) => setRows(rows.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))} required />
                    {rows.length > 1 && <button type="button" className="chip-remove" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setRows([...rows, { text: "", audioIndex: null }])}>{t("addLine")}</button>
        </fieldset>
    );
}

function OrganizeContentEditor({ items, setItems }: { items: string[]; setItems: (v: string[]) => void }) {
    const t = useTranslations("exercises");
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("items")}</legend>
            {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted">#{i + 1}</span>
                    <input className="input" value={item} onChange={(e) => setItems(items.map((it, idx) => idx === i ? e.target.value : it))} required />
                    {items.length > 1 && <button type="button" className="chip-remove" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setItems([...items, ""])}>{t("addItem")}</button>
        </fieldset>
    );
}

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
}: {
    exercise?: Exercise | Partial<Exercise>;
    lesson_id: string;
    lessonElements: LessonElements;
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
        } else if (exerciseType === "dictation") {
            content = dictationContent(dictationLines);
            normalizedAnswer = content.lines.map(l => l.text).join(" ");
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
                onChange={(value) => setExerciseType(value as Exercise["exercise_type"])}
                required
            />

            {exerciseType !== undefined && (
                <>
                    {!["matching", "organize", "conversation", ...STRUCTURED_TYPES.filter(t => t !== "quizz")].includes(exerciseType) && (
                        <AutoSizeTextArea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            className="card flex w-full overflow-hidden p-2"
                            label={t("questionLabel")}
                            required
                        />
                    )}

                    <AutoSizeTextArea
                        value={supportText}
                        onChange={(e) => setSupportText(e.target.value)}
                        className="card flex w-full overflow-hidden p-2"
                        label={t("support")}
                    />

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

                    {exerciseType === "reading" && <ReadingContentEditor rows={readingLines} setRows={setReadingLines} />}

                    {exerciseType === "dictation" && <DictationContentEditor rows={dictationLines} setRows={setDictationLines} />}

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