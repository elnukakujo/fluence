"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import SubmitButton from "@/components/ui/buttons/submitButton";
import Field from "@/components/ui/field";
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
import { FormActions, FormLayout, FormSection, FORM_LABEL } from "./formParts";

export default function VocabularyForm({vocabulary, lesson_id, onDone}: {vocabulary?: Vocabulary | Partial<Vocabulary>; lesson_id: string; onDone?: () => void}) {
    const t = useTranslations("vocabulary");
    const tEl = useTranslations("elements");

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
        onDone, existing: vocabularyData, lessonId: lesson_id, noun: "vocabulary",
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

    const types = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'article', 'preposition', 'conjunction', 'particle', 'interjection', 'numeral', 'classifier', 'auxiliary', 'modal'];
    return (
        <>
        {shell.conflictProps && <ConflictDialog {...shell.conflictProps} />}
        <FormLayout onSubmit={shell.handleSubmit}>
            <FormSection title={t("formHeading")} columns={3}>
                <Field label={t("wordLabel")} required labelClassName={FORM_LABEL}>
                    <input className="input" value={word} onChange={(e) => setWord(e.target.value)} placeholder={t("wordPlaceholder")} />
                </Field>
                <Field label={t("translationLabel")} labelClassName={FORM_LABEL}>
                    <input className="input" value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder={t("translationPlaceholder")} />
                </Field>
                <Field label={t("phoneticLabel")} labelClassName={FORM_LABEL}>
                    <input className="input" value={phonetic || ""} onChange={(e) => setPhonetic(e.target.value)} placeholder={t("phoneticPlaceholder")} />
                </Field>
                <ClassicSelectMenu label={t("wordTypeLabel")} options={types} selectedOption={type} onChange={(value) => setType(value as typeof type)} />
                <ClassicSelectMenu label={t("genderLabel")} options={['m', 'f', 'n', 'c', '']} selectedOption={gender || ""} onChange={(value) => setGender(value as typeof gender)} />
            </FormSection>
            <FormSection title={tEl("formMediaSection")} columns={1}>
                <MediaLoader imageUrl={wordImageUrl} setImageUrl={setWordImageUrl} audioUrl={wordAudioUrl} setAudioUrl={setWordAudioUrl} />
            </FormSection>
            <ExampleSentencesEditor heading={t("exampleSentencesHeading")} labels={{ sentence: t("exampleSentenceLabel"), translation: t("exampleSentenceTranslationLabel") }}
                sentences={exampleSentences} setSentences={setExampleSentences} />
            <FormSection title={tEl("formOrganisationSection")} columns={1}>
                <TagSelector selectedTagIds={shell.selectedTagIds} onTagsChange={shell.setSelectedTagIds} elementId={vocabularyData.id!} />
                <SourceSelector selectedSourceIds={shell.selectedSourceIds} onSourcesChange={shell.setSelectedSourceIds} elementId={vocabularyData.id!} />
            </FormSection>
            <FormActions note={tEl("formRequiredNote")}>
                <SubmitButton isLoading={shell.isSubmitting}>{shell.isUpdate ? t("updateButton") : t("addButton")}</SubmitButton>
            </FormActions>
        </FormLayout>
        </>
    );
}
