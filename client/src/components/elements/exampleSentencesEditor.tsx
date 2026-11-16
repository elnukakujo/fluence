"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdd, faTrash } from "@fortawesome/free-solid-svg-icons";
import Field from "@/components/ui/field";
import MediaLoader from "@/components/media/mediaLoader";
import type Passage from "@/interface/components/Passage";
import { Disclosure, FORM_LABEL } from "./formParts";

type FieldName = "text" | "translation" | "image_files" | "audio_files";

/** The editable list of example sentences (text, translation, media) shared by the vocabulary, grammar and calligraphy forms:
 *  one bordered card per sentence, the remove button at its top right, the add button (icon + words) below the list. */
export default function ExampleSentencesEditor({ heading, labels, sentences, setSentences, addLabel }: {
    heading: string;
    labels: { sentence: string; translation: string };
    sentences: Partial<Passage>[];
    setSentences: Dispatch<SetStateAction<Partial<Passage>[]>>;
    addLabel?: string;          // defaults to "Add example sentence"
}) {
    const t = useTranslations("elements");
    const change = (index: number, field: FieldName, value: string | string[]) => {
        setSentences((prev) => {
            const updated = [...prev];
            const sentence = updated[index] || { text: "", translation: "", image_files: [], audio_files: [] };
            if (field === "text" || field === "translation") sentence[field] = value as string;
            else sentence[field] = value as string[];
            updated[index] = sentence;
            return updated;
        });
    };

    return (
        <section className="card flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{heading}{sentences.length > 0 && <span className="ml-2 text-sm font-normal text-muted">({sentences.length})</span>}</h2>
            {sentences.map((sentence, key) => (
                <div className="relative grid gap-4 rounded-xl border border-border p-4 pr-16 sm:grid-cols-2" key={key}>
                    <button type="button" aria-label={t("removeExampleSentence")} className="btn btn-danger absolute right-3 top-3 min-h-11 min-w-11 px-2 py-1"
                        onClick={() => setSentences((prev) => prev.filter((_, index) => index !== key))}>
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                    <Field label={labels.sentence} required labelClassName={FORM_LABEL}>
                        <input className="input" value={sentence.text || ""} onChange={(e) => change(key, "text", e.target.value)} />
                    </Field>
                    <Field label={labels.translation} labelClassName={FORM_LABEL}>
                        <input className="input" value={sentence.translation || ""} onChange={(e) => change(key, "translation", e.target.value)} />
                    </Field>
                    <Disclosure title={t("formMediaSection")} count={(sentence.image_files?.length ?? 0) + (sentence.audio_files?.length ?? 0)}>
                        <MediaLoader imageUrl={sentence.image_files || []} setImageUrl={(files) => change(key, "image_files", files)}
                            audioUrl={sentence.audio_files || []} setAudioUrl={(files) => change(key, "audio_files", files)} />
                    </Disclosure>
                </div>
            ))}
            <button type="button" className="btn btn-secondary min-h-11 min-w-11 self-start"
                onClick={() => setSentences((prev) => [...prev, { text: "", translation: "", image_files: [], audio_files: [] }])}>
                <FontAwesomeIcon icon={faAdd} /> {addLabel ?? t("addExampleSentence")}
            </button>
        </section>
    );
}
