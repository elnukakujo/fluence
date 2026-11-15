"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import SubmitButton from "@/components/ui/buttons/submitButton";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import TagSelector from "@/components/tags/tagSelector";
import { createVocabulary, updateVocabulary } from "@/api/vocabulary";
import MediaLoader from "@/components/media/mediaLoader";
import Vocabulary from "@/interface/features/Vocabulary";
import Passage from "@/interface/components/Passage";
import SourceSelector from "@/components/sources/sourceSelector";
import ConflictDialog from "@/components/ui/dialogs/conflictDialog";
import ExampleSentencesEditor from "./exampleSentencesEditor";
import { useElementForm } from "./useElementForm";

export default function VocabularyForm({vocabulary, lesson_id}: {vocabulary?: Vocabulary | Partial<Vocabulary>; lesson_id: string}) {
    const t = useTranslations("vocabulary");

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

    const shell = useElementForm<Vocabulary>({
        existing: vocabularyData, lessonId: lesson_id, noun: "vocabulary",
        messages: { createFailure: t("createFailure"), updateFailure: t("updateFailure"), resolveConflictError: t("resolveConflictError") },
        build: (shared) => ({
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
            ...shared,
        }),
        create: createVocabulary, update: updateVocabulary,
        mergeInto: (element, resolved) => Object.assign(element.word!, resolved),
    });

    return (
        <>
        {shell.conflictProps && <ConflictDialog {...shell.conflictProps} />}
        <form
            className="flex flex-col space-y-12"
            onSubmit={shell.handleSubmit}
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
                selectedTagIds={shell.selectedTagIds}
                onTagsChange={shell.setSelectedTagIds}
                elementId={vocabularyData.id!}
            />
            <SourceSelector
                selectedSourceIds={shell.selectedSourceIds}
                onSourcesChange={shell.setSelectedSourceIds}
                elementId={vocabularyData.id!}
            />
            <ExampleSentencesEditor heading={t("exampleSentencesHeading")} labels={{ sentence: t("exampleSentenceLabel"), translation: t("exampleSentenceTranslationLabel") }}
                sentences={exampleSentences} setSentences={setExampleSentences} />
            {shell.isUpdate ? <SubmitButton isLoading={shell.isSubmitting}>{t("updateButton")}</SubmitButton> : <SubmitButton isLoading={shell.isSubmitting}>{t("addButton")}</SubmitButton>}
        </form>
        </>
    );
}