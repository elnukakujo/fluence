"use client";
import { useState, useRef, useEffect } from "react";
import SubmitButton from "@/components/ui/buttons/submitButton";
import { useRouter } from "next/navigation";
import Source from '@/interface/systemData/Source';
import { createSource, updateSource } from "@/api/source";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import { getCurrentUserId } from "@/utils/user_cookie";
import { useTranslations } from "next-intl";

export default function SourceForm({ source, navDisabled = false, onSuccess }: { source?: Source | Partial<Source>, navDisabled?: boolean, onSuccess?: () => void }) {
    const isUpdate = Boolean(source?.id);
    const router = useRouter();
    const t = useTranslations("sources");

    const sourceData: Partial<Source> = source ?? {
        id: "", user_id: "", title: "", date: "", description: "", source_type: ""
    };

    const [userId, setUserId] = useState<string>("");
    const [title, setTitle] = useState<string>(sourceData.title || "");
    const [description, setDescription] = useState<string>(sourceData.description || "");
    const [sourceType, setSourceType] = useState<string>(sourceData.source_type || "original");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchUserId = async () => {
            const currentUserId = await getCurrentUserId();
            setUserId(currentUserId!);
        };
        fetchUserId();
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const element: Partial<Source> = {
            id: sourceData.id,
            user_id: userId,
            title,
            source_type: sourceType,
            description,
        };
        setIsSubmitting(true);
        try {
        if (isUpdate) {
            await updateSource(sourceData.id!, element);
        } else {
            await createSource(element);
        }
        if (!navDisabled) {
            router.push(`/sources`);
            router.refresh();
        }
        } catch (error) {
        console.error("Error creating/updating source:", error);
        alert(`Failed to ${isUpdate ? t("updateSource") : t("addSource")}.`);
        } finally {
        setIsSubmitting(false);
        if (onSuccess) onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 items-center">
        <AutoWidthInput
            label={t("name")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("sourceNamePlaceholder")}
            required
        />

        <ClassicSelectMenu
            label={t("sourceType")}
            options={[ "original", "textbook", "class", "online", "media", "social", "other" ]}
            selectedOption={sourceType}
            onChange={(e) => setSourceType(e as string)}
            required
        />

        <AutoSizeTextArea
            label={t("description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
        />

        {isUpdate ? <SubmitButton isLoading={isSubmitting}>{t("updateSource")}</SubmitButton> : <SubmitButton isLoading={isSubmitting}>{t("addSource")}</SubmitButton>}
        </form>
    );
}