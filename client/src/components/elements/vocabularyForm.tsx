"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import SubmitButton from "@/components/ui/buttons/submitButton";
import { useRouter } from "next/navigation";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import TagSelector from "@/components/tags/tagSelector";
import { createVocabulary, updateVocabulary } from "@/api/vocabulary";
import MediaLoader from "@/components/media/mediaLoader";
import Vocabulary from "@/interface/features/Vocabulary";
import Passage from "@/interface/components/Passage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdd, faTrash } from "@fortawesome/free-solid-svg-icons";
import SourceSelector from "@/components/sources/sourceSelector";
import ConflictError from "@/api/conflictError";
import ConflictDialog from "@/components/ui/dialogs/conflictDialog";

export default function VocabularyForm({vocabulary, lesson_id}: {vocabulary?: Vocabulary | Partial<Vocabulary>; lesson_id: string}) {
    const t = useTranslations("vocabulary");
    const router = useRouter();
    const isUpdate = Boolean(vocabulary?.id);

    let vocabularyData: Partial<Vocabulary>;
    if (!vocabulary) {
        vocabularyData = {
            word: {
                word: "",
                translation: "",
                word_type: "" as Exclude<typeof type, ''>,
                word_gender: undefined,
                phonetic: undefined,
                image_files: [],
                audio_files: []
            },
            example_sentences: [],
            lesson_id: lesson_id
        };
    } else {
        vocabularyData = vocabulary;
    }

    const [word, setWord] = useState<string>(vocabularyData!.word!.word!);
    const [translation, setTranslation] = useState<string>(vocabularyData!.word!.translation!);
    const [phonetic, setPhonetic] = useState<string | undefined>(vocabularyData.word?.phonetic);
    const [type, setType] = useState<'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'article' | 
        'preposition' | 'conjunction' | 'particle' | 'interjection' | 'numeral' | 
        'classifier' | 'auxiliary' | 'modal'>(vocabularyData.word!.word_type!);
    const [gender, setGender] = useState<'m' | 'f' | 'n' | 'c' | '' | undefined>(vocabularyData.word?.word_gender);
    const [wordImageUrl, setWordImageUrl] = useState<string[]>(vocabularyData.word?.image_files || []);
    const [wordAudioUrl, setWordAudioUrl] = useState<string[]>(vocabularyData.word?.audio_files || []);

    const [exampleSentences, setExampleSentences] = useState<Partial<Passage>[]>(vocabularyData.example_sentences!);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(vocabularyData.tags ? vocabularyData.tags.map(tag => tag.id!) : []);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(vocabularyData.sources ? vocabularyData.sources.map(source => source.id!) : []);
    const [conflict, setConflict] = useState<ConflictError | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const buildElement = (): Partial<Vocabulary> => ({
        word: {
            word: word,
            translation: translation,
            word_type: type,
            word_gender: gender,
            phonetic: phonetic,
            image_files: wordImageUrl,
            audio_files: wordAudioUrl
        },
        example_sentences: exampleSentences,
        lesson_id: lesson_id,
        tags: selectedTagIds.map(tagId => ({ id: tagId })),
        sources: selectedSourceIds.map(sourceId => ({ id: sourceId }))
    });

    // Extract language_id from current URL
    const languageIdFromPath = () => window.location.pathname.split('/')[2]; // From /languages/LANG_ID/...

    const submit = async (element: Partial<Vocabulary>, onConflict?: "keep" | "overwrite" | "merge") => {
        if (isUpdate) {
            await updateVocabulary(vocabularyData.id!, element);
        } else {
            await createVocabulary(element, onConflict);
        }
        router.push(`/languages/${languageIdFromPath()}/lesson/${lesson_id}`);
        router.refresh();
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const element = buildElement();

        setIsSubmitting(true);
        try {
            await submit(element);
        } catch (error) {
            if (error instanceof ConflictError) {
                setConflict(error);
                return;
            }
            console.error(`Failed to ${isUpdate ? "update" : "create"} vocabulary:`, error);
            alert(isUpdate ? t("updateFailure") : t("createFailure"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const resolveConflict = async (element: Partial<Vocabulary>, onConflict: "keep" | "overwrite" | "merge") => {
        setConflict(null);
        setIsSubmitting(true);
        try {
            await submit(element, onConflict);
        } catch (error) {
            console.error("Failed to resolve vocabulary conflict:", error);
            alert("Failed to resolve conflict. Check console for details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeepExisting = () => resolveConflict(buildElement(), "keep");
    const handleOverwrite = () => resolveConflict(buildElement(), "overwrite");
    const handleManualResolve = (resolvedFields: Record<string, string>) => {
        const element = buildElement();
        Object.assign(element.word!, resolvedFields);
        resolveConflict(element, "merge");
    };

    const handleExampleSentenceChange = (index: number, field: "text" | "translation" | "image_files" | "audio_files", value: string | string[]) => {
        setExampleSentences(prevSentences => {
            const updatedSentences = [...prevSentences];
            const sentenceToUpdate = updatedSentences[index] || { text: "", translation: "", image_files: [], audio_files: [] };
            
            if (field === "text" || field === "translation") {
                sentenceToUpdate[field] = value as string;
            } else if (field === "image_files" || field === "audio_files") {
                sentenceToUpdate[field] = value as string[];
            }
            
            updatedSentences[index] = sentenceToUpdate;
            return updatedSentences;
        });
    };

    return (
        <>
        {conflict && (
            <ConflictDialog
                error={conflict}
                onKeep={handleKeepExisting}
                onOverwrite={handleOverwrite}
                onManualResolve={handleManualResolve}
                onCancel={() => setConflict(null)}
            />
        )}
        <form
            className="flex flex-col space-y-12"
            onSubmit={handleSubmit}
        >
            <article className="flex flex-col space-y-2 items-center">
                <h3>{t("formHeading")}</h3>
                <AutoWidthInput
                    value={word}
                    label={t("wordLabel")}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder={t("wordPlaceholder")}
                    required={true}
                />
                <AutoWidthInput
                    value={translation}
                    label={t("translationLabel")}
                    onChange={(e) => setTranslation(e.target.value)}
                    placeholder={t("translationPlaceholder")}
                />
                <ClassicSelectMenu
                    label={t("wordTypeLabel")}
                    options={[
                        'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'article',
                        'preposition', 'conjunction', 'particle', 'interjection', 'numeral',
                        'classifier', 'auxiliary', 'modal'
                    ]}
                    selectedOption={type}
                    onChange={(value) => setType(value as typeof type)}
                />
                <ClassicSelectMenu
                    label={t("genderLabel")}
                    options={[
                        'm', 'f', 'n', 'c', ''
                    ]}
                    selectedOption={gender || ""}
                    onChange={(value) => setGender(value as typeof gender)}
                />
                <AutoWidthInput
                    value={phonetic || ""}
                    label={t("phoneticLabel")}
                    onChange={(e) => setPhonetic(e.target.value)}
                    placeholder={t("phoneticPlaceholder")}
                />
                <MediaLoader imageUrl={wordImageUrl} setImageUrl={setWordImageUrl} audioUrl={wordAudioUrl} setAudioUrl={setWordAudioUrl} />
            </article>
            <TagSelector
                selectedTagIds={selectedTagIds}
                onTagsChange={setSelectedTagIds}
                elementId={vocabularyData.id!}
            />
            <SourceSelector
                selectedSourceIds={selectedSourceIds}
                onSourcesChange={setSelectedSourceIds}
                elementId={vocabularyData.id!}
            />
            <article className="flex flex-col space-y-2 items-center">
                <h3>{t("exampleSentencesHeading")}</h3>
                {exampleSentences.map((sentence, key) => (
                    <section className="flex flex-col space-y-2 items-center" key={key}>
                        <button
                            className="btn btn-danger h-fit px-2 py-1"
                            onClick={() => {
                                setExampleSentences(prev => prev.filter((_, index) => index !== key));
                            }}
                        >
                            <FontAwesomeIcon icon={faTrash}/>
                        </button>
                        <AutoWidthInput
                            label={t("exampleSentenceLabel")}
                            value={sentence.text || ""}
                            required
                            onChange={(e) => handleExampleSentenceChange(key, "text", e.target.value)}
                        />
                        <AutoWidthInput
                            label={t("exampleSentenceTranslationLabel")}
                            value={sentence.translation || ""}
                            onChange={(e) => handleExampleSentenceChange(key, "translation", e.target.value)}
                        />
                        <MediaLoader imageUrl={sentence.image_files} setImageUrl={handleExampleSentenceChange.bind(null, key, "image_files")} audioUrl={sentence.audio_files} setAudioUrl={handleExampleSentenceChange.bind(null, key, "audio_files")} />
                    </section>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        setExampleSentences(prev => [...prev, { text: "", translation: "", image_files: [], audio_files: [] }]);
                    }}
                    className="btn btn-primary"
                >
                    <FontAwesomeIcon icon={faAdd}/>
                </button>
            </article>
            {isUpdate ? <SubmitButton isLoading={isSubmitting}>{t("updateButton")}</SubmitButton> : <SubmitButton isLoading={isSubmitting}>{t("addButton")}</SubmitButton>}
        </form>
        </>
    );
}