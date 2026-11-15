"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdd, faTrash } from "@fortawesome/free-solid-svg-icons";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import MediaLoader from "@/components/media/mediaLoader";
import type Passage from "@/interface/components/Passage";

type Field = "text" | "translation" | "image_files" | "audio_files";

/** The editable list of example sentences (text, translation, media) shared by the vocabulary, grammar and calligraphy forms. */
export default function ExampleSentencesEditor({ heading, labels, sentences, setSentences, itemClassName = "flex flex-col space-y-2 items-center", addLabel }: {
    heading: string;
    labels: { sentence: string; translation: string };
    sentences: Partial<Passage>[];
    setSentences: Dispatch<SetStateAction<Partial<Passage>[]>>;
    itemClassName?: string;     // the calligraphy form frames each sentence as a card
    addLabel?: string;          // the calligraphy form words its add button; the others show the icon alone
}) {
    const t = useTranslations("elements");
    const change = (index: number, field: Field, value: string | string[]) => {
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
        <article className="flex flex-col space-y-2 items-center">
            <h3>{heading}</h3>
            {sentences.map((sentence, key) => (
                <section className={itemClassName} key={key}>
                    <button type="button" aria-label={t("removeExampleSentence")} className="btn btn-danger min-h-11 min-w-11 px-2 py-1" onClick={() => setSentences((prev) => prev.filter((_, index) => index !== key))}>
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                    <AutoWidthInput label={labels.sentence} value={sentence.text || ""} required onChange={(e) => change(key, "text", e.target.value)} />
                    <AutoWidthInput label={labels.translation} value={sentence.translation || ""} onChange={(e) => change(key, "translation", e.target.value)} />
                    <MediaLoader imageUrl={sentence.image_files || []} setImageUrl={(files) => change(key, "image_files", files)}
                        audioUrl={sentence.audio_files || []} setAudioUrl={(files) => change(key, "audio_files", files)} />
                </section>
            ))}
            <button type="button" aria-label={addLabel ? undefined : t("addExampleSentence")} className="btn btn-primary min-h-11 min-w-11"
                onClick={() => setSentences((prev) => [...prev, { text: "", translation: "", image_files: [], audio_files: [] }])}>
                <FontAwesomeIcon icon={faAdd} />{addLabel && <> {addLabel}</>}
            </button>
        </article>
    );
}
