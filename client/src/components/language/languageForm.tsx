"use client";

import { useTranslations } from "next-intl";
import { languageProficiencySystems } from "@/utils/language_iso639";
import SubmitButton from "@/components/ui/buttons/submitButton";
import {getUserById} from "@/api/user";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import { createLanguage, updateLanguage } from "@/api/language";
import type Language from "@/interface/containers/Language";
import TagSelector from "@/components/tags/tagSelector";
import { LANGUAGE_to_ISO639_2T, LANGUAGE_FLAGS } from "@/utils/language_iso639";
import SourceSelector from "@/components/sources/sourceSelector";
import { getCurrentUserId } from "@/utils/user_cookie";
import User from "@/interface/systemData/User";

const ISO639_2T_to_LANGUAGE: Record<string, string> = Object.fromEntries(
    Object.entries(LANGUAGE_to_ISO639_2T).map(([language, iso]) => [iso, language])
);

export default function LanguageForm({language}: { language?: Partial<Language> }) {
    const t = useTranslations("language");
    const router = useRouter();
    const isUpdate = Boolean(language?.id);
    let languageData: Partial<Language>;
    if (!language) {
        languageData = {
            user_id: "",
            name: "",
            alias: "",
            description: "",
            level: 0,
            flag: "",
            target_iso639_2t: "",
            source_iso639_2t: "eng",
        };
    } else {
        languageData = language;
    }

    const [userId, setUserId] = useState<string>("");
    const [name, setName] = useState<string>(languageData.name || "");
    const [alias, setAlias] = useState<string | undefined>(languageData.alias);
    const [description, setDescription] = useState<string | undefined>(languageData.description);
    const [level, setLevel] = useState<Language["level"]>(languageData.level || 0);
    const [flag, setFlag] = useState<string | undefined>(languageData.flag);
    const [targetIso639_2t, setTargetIso639_2t] = useState<string | undefined>(languageData.target_iso639_2t);
    const [sourceIso639_2t, setSourceIso639_2t] = useState<string | undefined>(languageData.source_iso639_2t);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(languageData.tags ? languageData.tags.map(tag => tag.id!) : []);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(languageData.sources ? languageData.sources.map(source => source.id!) : []);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        const fetchUserId = async () => {
            const userId: string | null = await getCurrentUserId();
            setUserId(userId!);
        }
        fetchUserId();
    }, []);

    const [knownLanguageISO639_2T, setKnownLanguageISO639_2T] = useState<string[]>([]);

    useEffect(() => {
        const fetchKnownLanguages = async () => {
            if (!userId) return;

            try {
                const response: User = await getUserById(userId);
                setKnownLanguageISO639_2T(response.preferences?.native_language_iso639_2 || []);
            } catch (error) {
                console.error("Failed to fetch user data:", error);
            }
        };
        fetchKnownLanguages();
    }, [userId]);

    const [levelOptions, setLevelOptions] = useState<string[]>(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']); // Default options if no target language is selected
    useEffect(() => {
        if (targetIso639_2t) {
            setLevelOptions(languageProficiencySystems[targetIso639_2t].levels.map((l) => l.code));
        }
    }, [targetIso639_2t]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const element: Partial<Language> = {
            name,
            alias: alias || undefined,
            description: description || undefined,
            level,
            flag: flag || undefined,
            user_id: userId,
            target_iso639_2t: targetIso639_2t || undefined,
            source_iso639_2t: sourceIso639_2t || undefined,
            tags: selectedTagIds.map(id => ({ id })),
            sources: selectedSourceIds.map(id => ({ id }))
        };

        setIsSubmitting(true);
        try {
            console.debug(element);
            if (isUpdate) {
                await updateLanguage(languageData.id!, element);
            } else {
                await createLanguage(element);
            }

            router.push("/");
            router.refresh();
        } catch (error) {
            console.error(`Failed to ${isUpdate ? "update" : "create"} language:`, error);
            alert(t(isUpdate ? "updateFailed" : "createFailed"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="flex flex-col space-y-4 items-center" onSubmit={handleSubmit}>
            <ClassicSelectMenu
                label={t("languageName")}
                options={Object.keys(LANGUAGE_to_ISO639_2T)}
                selectedOption={name}
                onChange={(value) => {
                    const selected = value as string;
                    setName(selected);
                    setTargetIso639_2t(LANGUAGE_to_ISO639_2T[selected] || "");
                    setFlag(LANGUAGE_FLAGS[selected] || "");
                }}
                required
            />
            {(name === "Custom" || (!Object.keys(LANGUAGE_to_ISO639_2T).includes(name) && name !== "")) && (
                <AutoWidthInput
                    value={name}
                    label={t("customLanguageName")}
                    onChange={(e) => {
                        setName(e.target.value);
                        setTargetIso639_2t(LANGUAGE_to_ISO639_2T[e.target.value] || "");
                    }}
                    placeholder={t("enterLanguageName")}
                    required
                />
            )}

            <AutoWidthInput
                value={alias || ""}
                label={t("alias")}
                onChange={(e) => setAlias(e.target.value)}
                placeholder={t("enterAlias")}
            />

            <AutoSizeTextArea
                value={description || ""}
                onChange={(e) => setDescription(e.target.value)}
                label={t("description")}
                placeholder={t("enterDescription")}
            />

            <ClassicSelectMenu
                label={t("level")}
                options={levelOptions}
                selectedOption={levelOptions[level]}
                onChange={(value) => setLevel(levelOptions.indexOf(value as string))}
                required
            />

            {(name === "Custom" || (!Object.keys(LANGUAGE_to_ISO639_2T).includes(name) && name !== "")) && (
                <AutoWidthInput
                    value={flag || ""}
                    label={t("flag")}
                    onChange={(e) => setFlag(e.target.value)}
                    placeholder={t("enterFlagEmoji")}
                />
            )}

            <ClassicSelectMenu
                label={t("languageUsedToStudy")}
                options={knownLanguageISO639_2T.map(iso => ISO639_2T_to_LANGUAGE[iso] || iso)}
                selectedOption={ISO639_2T_to_LANGUAGE[sourceIso639_2t || ""] || ""}
                onChange={(value) => setSourceIso639_2t(LANGUAGE_to_ISO639_2T[value as string] || "")}
                required
            />

            <TagSelector
                selectedTagIds={selectedTagIds}
                onTagsChange={setSelectedTagIds}
                elementId={languageData.id!}
            />

            <SourceSelector
                selectedSourceIds={selectedSourceIds}
                onSourcesChange={setSelectedSourceIds}
                elementId={languageData.id!}
            />

            {isUpdate ? <SubmitButton isLoading={isSubmitting}>{t("updateLanguage")}</SubmitButton> : <SubmitButton isLoading={isSubmitting}>{t("addLanguage")}</SubmitButton>}
        </form>
    );
}