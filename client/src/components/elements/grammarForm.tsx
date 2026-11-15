"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import SubmitButton from "@/components/ui/buttons/submitButton";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import TagSelector from "@/components/tags/tagSelector";
import SourceSelector from "@/components/sources/sourceSelector";
import { createGrammar, updateGrammar } from "@/api/grammar";
import Grammar from "@/interface/features/Grammar";
import Passage from "@/interface/components/Passage";
import ExampleSentencesEditor from "./exampleSentencesEditor";
import { useElementForm } from "./useElementForm";

export default function GrammarForm({grammar, lesson_id}: {grammar?: Partial<Grammar>; lesson_id: string}) {
    const t = useTranslations("grammar");

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

    const shell = useElementForm<Grammar>({
        existing: grammarData, lessonId: lesson_id, noun: "grammar",
        messages: { createFailure: t("createFailure"), updateFailure: t("updateFailure") },
        build: (shared) => ({ title: title, explanation: explanation, example_sentences: learnableSentence, ...shared }),
        create: (element) => createGrammar(element), update: updateGrammar,   // a grammar point has no duplicate to resolve
    });

    return (
        <form className="flex flex-col space-y-12" onSubmit={shell.handleSubmit}>
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
                selectedTagIds={shell.selectedTagIds}
                onTagsChange={shell.setSelectedTagIds}
                elementId={grammarData.id!}
            />
            <SourceSelector
                selectedSourceIds={shell.selectedSourceIds}
                onSourcesChange={shell.setSelectedSourceIds}
                elementId={grammarData.id!}
            />
            <ExampleSentencesEditor heading={t("learnableSentencesHeading")} labels={{ sentence: t("exampleSentenceLabel"), translation: t("exampleSentenceTranslationLabel") }}
                sentences={learnableSentence} setSentences={setLearnableSentence} />
            {shell.isUpdate ? <SubmitButton isLoading={shell.isSubmitting}>{t("updateButton")}</SubmitButton> : <SubmitButton isLoading={shell.isSubmitting}>{t("addButton")}</SubmitButton>}
        </form>
    );
}