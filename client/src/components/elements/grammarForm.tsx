"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import SubmitButton from "@/components/ui/buttons/submitButton";
import { useRouter } from "next/navigation";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import TagSelector from "@/components/tags/tagSelector";
import SourceSelector from "@/components/sources/sourceSelector";
import { createGrammar, updateGrammar } from "@/api/grammar";
import MediaLoader from "@/components/media/mediaLoader";
import Grammar from "@/interface/features/Grammar";
import Passage from "@/interface/components/Passage";
import { faTrash, faAdd } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function GrammarForm({grammar, lesson_id}: {grammar?: Partial<Grammar>; lesson_id: string}) {
    const t = useTranslations("grammar");
    const router = useRouter();
    const isUpdate = Boolean(grammar?.id);

    let grammarData: Partial<Grammar>;
    if (!grammar) {
        grammarData = {
            title: "",
            explanation: "",
            example_sentences: [],
            lesson_id: lesson_id
        };
    } else {
        grammarData = grammar;
    }
    
    const [title, setTitle] = useState<string>(grammarData.title || "");
    const [explanation, setExplanation] = useState<string>(grammarData.explanation || "");

    const [learnableSentence, setLearnableSentence] = useState<Partial<Passage>[]>(grammarData.example_sentences!);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(grammarData.tags ? grammarData.tags.map(tag => tag.id!) : []);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(grammarData.sources ? grammarData.sources.map(source => source.id!) : []);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        // Extract language_id from current URL
        const currentPath = window.location.pathname;
        const pathParts = currentPath.split('/');
        const languageId = pathParts[2]; // From /languages/LANG_ID/...
        
        const element: Partial<Grammar> = {
            title: title,
            explanation: explanation,
            example_sentences: learnableSentence,
            lesson_id: lesson_id,
            tags: selectedTagIds.map(id => ({ id })),
            sources: selectedSourceIds.map(id => ({ id }))
        };
        
        setIsSubmitting(true);
        try {
            let grammarId: string;
            if (isUpdate) {
                await updateGrammar(grammarData.id!, element);
                grammarId = grammarData.id!;
            } else {
                const response = await createGrammar(element);
                grammarId = response.id;
            }

            router.push(`/languages/${languageId}/lesson/${lesson_id}`);
            router.refresh();
        } catch (error) {
            console.error(`Failed to ${isUpdate ? "update" : "create"} grammar:`, error);
            alert(isUpdate ? t("updateFailure") : t("createFailure"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLearnableSentenceChange = (index: number, field: "text" | "translation" | "image_files" | "audio_files", value: string | string[]) => {
        setLearnableSentence(prevSentences => {
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
        <form className="flex flex-col space-y-12" onSubmit={handleSubmit}>
            <article className="flex flex-col space-y-2 items-center">
                <h3>{t("formHeading")}</h3>
                <AutoWidthInput
                    label={t("titleLabel")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required={true}
                />
                <AutoSizeTextArea
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    label={t("explanationLabel")}
                    required={true}
                />
            </article>
            <TagSelector
                selectedTagIds={selectedTagIds}
                onTagsChange={setSelectedTagIds}
                elementId={grammarData.id!}
            />
            <SourceSelector
                selectedSourceIds={selectedSourceIds}
                onSourcesChange={setSelectedSourceIds}
                elementId={grammarData.id!}
            />
            <article className="flex flex-col space-y-2 items-center">
                <h3>{t("learnableSentencesHeading")}</h3>
                {learnableSentence.map((sentence, key) => (
                    <section className="flex flex-col space-y-2 items-center" key={key}>
                            <button
                                className="btn btn-danger h-fit px-2 py-1"
                                onClick={() => {
                                    setLearnableSentence(prev => prev.filter((_, index) => index !== key));
                                }}
                            >
                                <FontAwesomeIcon icon={faTrash}/>
                            </button>
                            <AutoWidthInput
                                label={t("exampleSentenceLabel")}
                                value={sentence.text || ""}
                                required
                                onChange={(e) => handleLearnableSentenceChange(key, "text", e.target.value)}
                            />
                            <AutoWidthInput
                                label={t("exampleSentenceTranslationLabel")}
                                value={sentence.translation || ""}
                                onChange={(e) => handleLearnableSentenceChange(key, "translation", e.target.value)}
                            />
                            <MediaLoader imageUrl={sentence.image_files} setImageUrl={handleLearnableSentenceChange.bind(null, key, "image_files")} audioUrl={sentence.audio_files} setAudioUrl={handleLearnableSentenceChange.bind(null, key, "audio_files")} />
                    </section>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        setLearnableSentence(prev => [...prev, { text: "", translation: "", image_files: [], audio_files: [] }]);
                    }}
                    className="btn btn-primary"
                >
                    <FontAwesomeIcon icon={faAdd}/>
                </button>
            </article>
            {isUpdate ? <SubmitButton isLoading={isSubmitting}>{t("updateButton")}</SubmitButton> : <SubmitButton isLoading={isSubmitting}>{t("addButton")}</SubmitButton>}
        </form>
    );
}