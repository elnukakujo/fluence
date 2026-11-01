"use client";

import { useTranslations } from "next-intl";
import { languageProficiencySystems } from "@/utils/language_iso639";
import SubmitButton from "@/components/ui/buttons/submitButton";
import { getLanguageById } from "@/api/language";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import TagSelector from "@/components/tags/tagSelector";
import { createLesson, updateLesson } from "@/api/lesson";
import type Lesson from "@/interface/containers/Lesson";
import SourceSelector from "@/components/sources/sourceSelector";
import Language from "@/interface/containers/Language";

export default function LessonForm({ lesson, language_id }: { lesson?: Partial<Lesson>; language_id: string }) {
    const t = useTranslations("lesson");
    const router = useRouter();
    const isUpdate = Boolean(lesson?.id);
    let lessonData: Partial<Lesson>;
    if (!lesson) {
        lessonData = {
            language_id: language_id,
            title: "",
            description: "",
            level: 0
        };
    } else {
        lessonData = lesson;
    }

    const [title, setTitle] = useState<string>(lessonData.title || "");
    const [description, setDescription] = useState<string | undefined>(lessonData.description);
    const [level, setLevel] = useState<Lesson["level"]>(lessonData.level || 0);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(lessonData.tags ? lessonData.tags.map(tag => tag.id!) : []);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(lessonData.sources ? lessonData.sources.map(source => source.id!) : []);

    const [levelOptions, setLevelOptions] = useState<string[]>(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']); // Default options if no target language is selected
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEffect(() => {
        const getLanguageAndSetLevels = async () => {
            const language: Language = await getLanguageById(language_id);
            const targetIso639_2t = language.target_iso639_2t;
            if (targetIso639_2t) {
                setLevelOptions(languageProficiencySystems[targetIso639_2t].levels.map((l) => l.code));
            }
        };
        getLanguageAndSetLevels();
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const element: Partial<Lesson> = {
            title: title,
            level: level,
            description: description,
            language_id: language_id,
            tags: selectedTagIds.map(id => ({ id })),
            sources: selectedSourceIds.map(id => ({ id }))
        };

        setIsSubmitting(true);
        try {
            let lessonId: string;
            if (isUpdate) {
                await updateLesson(lessonData.id!, element);
                lessonId = lessonData.id!;
            } else {
                const response = await createLesson(element);
                lessonId = response.id;
            }

            router.push(`/languages/${language_id}`);
            router.refresh();
        } catch (error) {
            console.error(`Failed to ${isUpdate ? "update" : "create"} lesson:`, error);
            alert(`Failed to ${isUpdate ? "update" : "create"} lesson. Check console for details.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="flex flex-col space-y-4 items-center" onSubmit={handleSubmit}>
            <AutoWidthInput
                value={title}
                label={t("lessonTitle")}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("enterLessonTitle")}
                required={true}
            />

            <AutoSizeTextArea
                value={description || ""}
                label={t("description")}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("enterLessonDescription")}
            />

            <ClassicSelectMenu
                label={t("level")}
                options={levelOptions}
                selectedOption={levelOptions[level]}
                onChange={(value) => setLevel(levelOptions.indexOf(value as string))}
                required
            />

            <TagSelector
                selectedTagIds={selectedTagIds}
                onTagsChange={setSelectedTagIds}
                elementId={lessonData.id!}
            />
            <SourceSelector
                selectedSourceIds={selectedSourceIds}
                onSourcesChange={setSelectedSourceIds}
                elementId={lessonData.id!}
            />

            {isUpdate ? <SubmitButton isLoading={isSubmitting}>{t("updateLesson")}</SubmitButton> : <SubmitButton isLoading={isSubmitting}>{t("addLesson")}</SubmitButton>}
        </form>
    );
}