"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import SubmitButton from "@/components/ui/buttons/submitButton";
import Field from "@/components/ui/field";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import TagSelector from "@/components/tags/tagSelector";
import SourceSelector from "@/components/sources/sourceSelector";
import { createGrammar, updateGrammar } from "@/api/grammar";
import Grammar from "@/interface/features/Grammar";
import Passage from "@/interface/components/Passage";
import ExampleSentencesEditor from "./exampleSentencesEditor";
import { useElementForm } from "./useElementForm";
import { FormActions, FormLayout, FormSection, FORM_LABEL } from "./formParts";

export default function GrammarForm({grammar, lesson_id, onDone}: {grammar?: Partial<Grammar>; lesson_id: string; onDone?: () => void}) {
    const t = useTranslations("grammar");
    const tEl = useTranslations("elements");

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
        onDone, existing: grammarData, lessonId: lesson_id, noun: "grammar",
        messages: { createFailure: t("createFailure"), updateFailure: t("updateFailure") },
        build: (shared) => ({ title: title, explanation: explanation, example_sentences: learnableSentence, ...shared }),
        create: (element) => createGrammar(element), update: updateGrammar,   // a grammar point has no duplicate to resolve
    });

    return (
        <FormLayout onSubmit={shell.handleSubmit}>
            <FormSection title={t("formHeading")} columns={1}>
                <Field label={t("titleLabel")} required labelClassName={FORM_LABEL}>
                    <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <AutoSizeTextArea value={explanation} onChange={(e) => setExplanation(e.target.value)} label={t("explanationLabel")} required={true} />
            </FormSection>
            <ExampleSentencesEditor heading={t("learnableSentencesHeading")} labels={{ sentence: t("exampleSentenceLabel"), translation: t("exampleSentenceTranslationLabel") }}
                sentences={learnableSentence} setSentences={setLearnableSentence} />
            <FormSection title={tEl("formOrganisationSection")} columns={1}>
                <TagSelector selectedTagIds={shell.selectedTagIds} onTagsChange={shell.setSelectedTagIds} elementId={grammarData.id!} />
                <SourceSelector selectedSourceIds={shell.selectedSourceIds} onSourcesChange={shell.setSelectedSourceIds} elementId={grammarData.id!} />
            </FormSection>
            <FormActions note={tEl("formRequiredNote")}>
                <SubmitButton isLoading={shell.isSubmitting}>{shell.isUpdate ? t("updateButton") : t("addButton")}</SubmitButton>
            </FormActions>
        </FormLayout>
    );
}
