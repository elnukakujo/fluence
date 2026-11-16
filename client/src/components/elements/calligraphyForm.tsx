"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import SubmitButton from "@/components/ui/buttons/submitButton";
import NumberField from "@/components/ui/input/numberField";
import Field from "@/components/ui/field";
import TagSelector from "@/components/tags/tagSelector";
import SourceSelector from "@/components/sources/sourceSelector";
import { createCalligraphy, updateCalligraphy } from "@/api/calligraphy";
import MediaLoader from "@/components/media/mediaLoader";
import Calligraphy from "@/interface/features/Calligraphy";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import Word from "@/interface/components/Word";
import Passage from "@/interface/components/Passage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faAdd } from "@fortawesome/free-solid-svg-icons";
import ConflictDialog from "@/components/ui/dialogs/conflictDialog";
import ExampleSentencesEditor from "./exampleSentencesEditor";
import { useElementForm } from "./useElementForm";
import CharacterLinksField, { type RadicalOption } from "./characterLinksField";
import { Disclosure, FormActions, FormLayout, FormSection, FORM_LABEL } from "./formParts";

export default function CalligraphyForm({calligraphy, lesson_id, radicalOptions = []}: {calligraphy?: Partial<Calligraphy>; lesson_id: string; radicalOptions?: RadicalOption[]}) {
    const t = useTranslations("calligraphy");
    const tEl = useTranslations("elements");
    let calligraphyData: Partial<Calligraphy>;
    if (!calligraphy) {
        calligraphyData = {
            character: {
                character: "",
                phonetic: "",
                meaning: "",
                radical: "",
                strokes: 0,
                image_files: [],
                audio_files: []
            },
            example_words: [],
            example_sentences: [],
            lesson_id: lesson_id
        };
    } else {
        calligraphyData = calligraphy;
    }
    
    const [character, setCharacter] = useState<string>(calligraphyData.character?.character || "");
    const [phonetic, setPhonetic] = useState<string>(calligraphyData.character?.phonetic || "");
    const [meaning, setMeaning] = useState<string|undefined>(calligraphyData.character?.meaning || undefined);
    const [radical, setRadical] = useState<string|undefined>(calligraphyData.character?.radical || undefined);
    const [componentList, setComponentList] = useState<string[]>(calligraphyData.character?.component_glyphs ?? []);
    const [strokes, setStrokes] = useState<number|undefined>(calligraphyData.character?.strokes || undefined);
    const [imageUrl, setImageUrl] = useState<string[]>(calligraphyData.character?.image_files || []);
    const [audioUrl, setAudioUrl] = useState<string[]>(calligraphyData.character?.audio_files || []);

    const [exampleWords, setExampleWords] = useState<Partial<Word>[]>(calligraphyData.example_words ? calligraphyData.example_words : []);
    const [exampleSentences, setExampleSentences] = useState<Partial<Passage>[]>(calligraphyData.example_sentences ? calligraphyData.example_sentences : []);

    const shell = useElementForm<Calligraphy>({
        existing: calligraphyData, lessonId: lesson_id, noun: "calligraphy",
        messages: { createFailure: t("createFailure"), updateFailure: t("updateFailure"), resolveConflictError: t("resolveConflictError") },
        build: (shared) => ({
            character: {
                character: character,
                phonetic: phonetic,
                meaning: meaning,
                radical: radical,
                clear_radical: calligraphy && !radical?.trim() ? true : undefined,
                component_glyphs: calligraphy ? componentList : (componentList.length ? componentList : undefined),   // new + empty: the app fills them
                strokes: strokes,
                image_files: imageUrl,
                audio_files: audioUrl
            },
            example_words: exampleWords,
            example_sentences: exampleSentences,
            ...shared,
        }),
        create: createCalligraphy, update: updateCalligraphy,
        mergeInto: (element, resolved) => Object.assign(element.character!, resolved),
    });

    const handleExampleWordChange = (index: number, field: "word" | "translation" | "word_type" | "word_gender" | "image_files" | "audio_files", value: string | string[]) => {
        setExampleWords(prevWords => {
            const updatedWords = [...prevWords];
            const wordToUpdate = updatedWords[index] || { word: "", translation: "", word_type: "" as const, image_files: [], audio_files: [] };
            
            if (field === "word" || field === "translation" || field === "word_type" || field === "word_gender") {
                (wordToUpdate as { [key: string]: string | string[] })[field] = value as string;
            } else if (field === "image_files" || field === "audio_files") {
                (wordToUpdate as { [key: string]: string | string[] })[field] = value as string[];
            }
            
            updatedWords[index] = wordToUpdate;
            return updatedWords;
        });
    };

    const wordTypes = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'article', 'preposition', 'conjunction', 'particle', 'interjection', 'numeral', 'classifier', 'auxiliary', 'modal'];
    return (
        <>
        {shell.conflictProps && <ConflictDialog {...shell.conflictProps} />}
        <FormLayout onSubmit={shell.handleSubmit}>
            <FormSection title={t("formHeading")} columns={4}>
                <Field label={t("characterLabel")} required labelClassName={FORM_LABEL}>
                    <input className="input text-center font-serif text-2xl" lang="zh" value={character} onChange={(e) => setCharacter(e.target.value)} />
                </Field>
                <Field label={t("phoneticLabel")} labelClassName={FORM_LABEL}>
                    <input className="input" value={phonetic} onChange={(e) => setPhonetic(e.target.value)} />
                </Field>
                <Field label={t("meaningLabel")} labelClassName={FORM_LABEL}>
                    <input className="input" value={meaning || ""} onChange={(e) => setMeaning(e.target.value)} />
                </Field>
                <span className="flex flex-col gap-1">
                    <span className={FORM_LABEL}>{t("strokesLabel")}</span>
                    <NumberField fill min={0} ariaLabel={t("strokesLabel")} value={strokes ?? ""} onChange={(v) => setStrokes(v === "" || v === 0 ? undefined : v)} />
                </span>
            </FormSection>
            <CharacterLinksField
                own={character} radicals={radicalOptions} creating={!calligraphy}
                radical={radical || ""} onRadical={setRadical}
                components={componentList} onComponents={setComponentList}
            />
            <FormSection title={tEl("formMediaSection")} columns={1}>
                <MediaLoader imageUrl={imageUrl} setImageUrl={setImageUrl} audioUrl={audioUrl} setAudioUrl={setAudioUrl} />
            </FormSection>
            <section className="card flex flex-col gap-4">
                <h2 className="text-lg font-semibold">{t("exampleWordsHeading")}{exampleWords.length > 0 && <span className="ml-2 text-sm font-normal text-muted">({exampleWords.length})</span>}</h2>
                {exampleWords.map((exampleWord, key) => (
                    <div key={key} className="relative grid gap-4 rounded-xl border border-border p-4 pr-16 sm:grid-cols-2">
                        <button type="button" aria-label={tEl("removeExampleWord")} className="btn btn-danger absolute right-3 top-3 min-h-11 min-w-11 px-2 py-1"
                            onClick={() => setExampleWords(prev => prev.filter((_, index) => index !== key))}>
                            <FontAwesomeIcon icon={faTrash}/>
                        </button>
                        <Field label={t("exampleWordLabel")} required labelClassName={FORM_LABEL}>
                            <input className="input" value={exampleWord.word || ""} onChange={(e) => handleExampleWordChange(key, "word", e.target.value)} />
                        </Field>
                        <Field label={t("exampleWordTranslationLabel")} labelClassName={FORM_LABEL}>
                            <input className="input" value={exampleWord.translation || ""} onChange={(e) => handleExampleWordChange(key, "translation", e.target.value)} />
                        </Field>
                        <ClassicSelectMenu label={t("exampleWordTypeLabel")} options={wordTypes} selectedOption={exampleWord.word_type || ""}
                            onChange={(value) => handleExampleWordChange(key, "word_type", value)} />
                        <ClassicSelectMenu label={t("exampleWordGenderLabel")} options={['m', 'f', 'n', 'c', '']} selectedOption={exampleWord.word_gender || ""}
                            onChange={(value) => handleExampleWordChange(key, "word_gender", value)} />
                        <Disclosure title={tEl("formMediaSection")} count={(exampleWord.image_files?.length ?? 0) + (exampleWord.audio_files?.length ?? 0)}>
                            <MediaLoader
                                imageUrl={exampleWord.image_files || []} setImageUrl={(files) => handleExampleWordChange(key, "image_files", files)}
                                audioUrl={exampleWord.audio_files || []} setAudioUrl={(files) => handleExampleWordChange(key, "audio_files", files)}
                            />
                        </Disclosure>
                    </div>
                ))}
                <button type="button" className="btn btn-secondary min-h-11 self-start"
                    onClick={() => setExampleWords(prev => [...prev, { word: "", translation: "", word_type: "noun", image_files: [], audio_files: [] }])}>
                    <FontAwesomeIcon icon={faAdd}/> {t("addExampleWordButton")}
                </button>
            </section>
            <ExampleSentencesEditor heading={t("exampleSentencesHeading")} labels={{ sentence: t("exampleSentenceLabel"), translation: t("exampleSentenceTranslationLabel") }}
                sentences={exampleSentences} setSentences={setExampleSentences} addLabel={t("addExampleSentenceButton")} />
            <FormSection title={tEl("formOrganisationSection")} columns={1}>
                <TagSelector selectedTagIds={shell.selectedTagIds} onTagsChange={shell.setSelectedTagIds} elementId={calligraphyData.id!} />
                <SourceSelector selectedSourceIds={shell.selectedSourceIds} onSourcesChange={shell.setSelectedSourceIds} elementId={calligraphyData.id!} />
            </FormSection>
            <FormActions note={tEl("formRequiredNote")}>
                <SubmitButton isLoading={shell.isSubmitting}>{shell.isUpdate ? t("updateButton") : t("addButton")}</SubmitButton>
            </FormActions>
        </FormLayout>
        </>
    );
}
