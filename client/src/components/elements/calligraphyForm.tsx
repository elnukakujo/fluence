"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import SubmitButton from "@/components/ui/buttons/submitButton";
import NumberField from "@/components/ui/input/numberField";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
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

export default function CalligraphyForm({calligraphy, lesson_id}: {calligraphy?: Partial<Calligraphy>; lesson_id: string}) {
    const t = useTranslations("calligraphy");
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

    return (
        <>
        {shell.conflictProps && <ConflictDialog {...shell.conflictProps} />}
        <form className="flex flex-col space-y-12" onSubmit={shell.handleSubmit}>
            <article className="flex flex-col space-y-2 items-center">
                <h3>{t("formHeading")}</h3>
                <AutoWidthInput
                    value={character}
                    onChange={(e) => setCharacter(e.target.value)}
                    label={t("characterLabel")}
                    required
                />
                <AutoWidthInput
                    value={phonetic}
                    onChange={(e) => setPhonetic(e.target.value)}
                    label={t("phoneticLabel")}
                />
                <AutoWidthInput
                    value={meaning || ""}
                    onChange={(e) => setMeaning(e.target.value)}
                    label={t("meaningLabel")}
                />
                <AutoWidthInput
                    value={radical || ""}
                    onChange={(e) => setRadical(e.target.value)}
                    label={t("radicalLabel")}
                />
                <span className="flex flex-col space-y-2">
                    <span className="text-sm font-medium text-foreground">{t("strokesLabel")}</span>
                    <NumberField min={0} ariaLabel={t("strokesLabel")} value={strokes ?? ""} onChange={(v) => setStrokes(v === "" || v === 0 ? undefined : v)} />
                </span>
                <MediaLoader imageUrl={imageUrl} setImageUrl={setImageUrl} audioUrl={audioUrl} setAudioUrl={setAudioUrl} />
            </article>
            <TagSelector
                selectedTagIds={shell.selectedTagIds}
                onTagsChange={shell.setSelectedTagIds}
                elementId={calligraphyData.id!}
            />
            <SourceSelector
                selectedSourceIds={shell.selectedSourceIds}
                onSourcesChange={shell.setSelectedSourceIds}
                elementId={calligraphyData.id!}
            />
            <article className="flex flex-col space-y-2 items-center">
                <h3>{t("exampleWordsHeading")}</h3>
                {exampleWords.map((exampleWord, key) => (
                    <section key={key} className="card flex flex-col space-y-2 items-center w-full">
                        <button
                            type="button"
                            className="btn btn-danger h-fit px-2 py-1"
                            onClick={() => {
                                setExampleWords(prev => prev.filter((_, index) => index !== key));
                            }}
                        >
                            <FontAwesomeIcon icon={faTrash}/>
                        </button>
                        <AutoWidthInput
                            value={exampleWord.word || ""}
                            onChange={(e) => handleExampleWordChange(key, "word", e.target.value)}
                            label={t("exampleWordLabel")}
                            required
                        />
                        <AutoWidthInput
                            value={exampleWord.translation || ""}
                            onChange={(e) => handleExampleWordChange(key, "translation", e.target.value)}
                            label={t("exampleWordTranslationLabel")}
                        />
                        <ClassicSelectMenu
                            label={t("exampleWordTypeLabel")}
                            options={[
                                'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'article',
                                'preposition', 'conjunction', 'particle', 'interjection', 'numeral',
                                'classifier', 'auxiliary', 'modal'
                            ]}
                            selectedOption={exampleWord.word_type || ""}
                            onChange={(value) => handleExampleWordChange(key, "word_type", value)}
                        />
                        <ClassicSelectMenu
                            label={t("exampleWordGenderLabel")}
                            options={[
                                'm', 'f', 'n', 'c', ''
                            ]}
                            selectedOption={exampleWord.word_gender || ""}
                            onChange={(value) => handleExampleWordChange(key, "word_gender", value)}
                        />
                        <MediaLoader 
                            imageUrl={exampleWord.image_files || []} 
                            setImageUrl={(files) => handleExampleWordChange(key, "image_files", files)} 
                            audioUrl={exampleWord.audio_files || []} 
                            setAudioUrl={(files) => handleExampleWordChange(key, "audio_files", files)}
                        />
                    </section>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        setExampleWords(prev => [...prev, { word: "", translation: "", word_type: "noun", image_files: [], audio_files: [] }]);
                    }}
                    className="btn btn-primary"
                >
                    <FontAwesomeIcon icon={faAdd}/> {t("addExampleWordButton")}
                </button>
            </article>
            <ExampleSentencesEditor heading={t("exampleSentencesHeading")} labels={{ sentence: t("exampleSentenceLabel"), translation: t("exampleSentenceTranslationLabel") }}
                sentences={exampleSentences} setSentences={setExampleSentences}
                itemClassName="card flex flex-col space-y-2 items-center w-full" addLabel={t("addExampleSentenceButton")} />
            {shell.isUpdate ? <SubmitButton isLoading={shell.isSubmitting}>{t("updateButton")}</SubmitButton> : <SubmitButton isLoading={shell.isSubmitting}>{t("addButton")}</SubmitButton>}
        </form>
        </>
    );
}