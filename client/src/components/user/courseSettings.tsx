"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "@/components/ui/sectionCard";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import InlineError from "@/components/ui/inlineError";
import FieldControl, { type Field } from "./fieldControl";
import SaveButton from "./saveButton";
import { type GroupName, type SettingValue, getSettingsGroup, saveSettingsGroup } from "@/api/settings";

export type CourseLanguage = { id: string; name: string };

// The per-course settings of the four groups, in one place with one course menu and one Save.
const COURSE_FIELDS: { group: GroupName; field: Field }[] = [
    { group: "pace", field: { key: "soft_gate", kind: "toggle" } },
    { group: "review", field: { key: "element_types", kind: "multi", options: ["vocabulary", "grammar", "calligraphy", "exercises", "passages"] } },
    { group: "review", field: { key: "include_shared", kind: "toggle" } },
    { group: "answer", field: { key: "typing_strictness", kind: "choice", options: ["forgiving", "exact"] } },
    { group: "see", field: { key: "show_phonetics", kind: "choice", options: ["always", "after_reveal", "never"] } },
];

/** Settings that differ per course (lesson gate, element types, shared lessons, typing, phonetics). One course menu for all. */
export default function CourseSettings({ languages, fold = false }: { languages: CourseLanguage[]; fold?: boolean }) {
    const tc = useTranslations("settingsGroups");
    const to = useTranslations("settingsGroups.options");
    const tp = useTranslations("settingsGroups.pace");
    const tr = useTranslations("settingsGroups.review");
    const ta = useTranslations("settingsGroups.answer");
    const ts = useTranslations("settingsGroups.see");
    const label: Record<string, typeof tp> = { pace: tp, review: tr, answer: ta, see: ts };
    const [languageId, setLanguageId] = useState<string | undefined>(languages[0]?.id);
    const [loaded, setLoaded] = useState<Record<string, SettingValue> | null>(null);
    const [draft, setDraft] = useState<Record<string, SettingValue>>({});
    const [overridden, setOverridden] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!languageId) return;
        const groups = [...new Set(COURSE_FIELDS.map((c) => c.group))];
        const all = await Promise.all(groups.map((g) => getSettingsGroup(g, languageId)));
        const values = Object.assign({}, ...all.map((g) => g.values));
        setLoaded(values); setDraft(values); setOverridden(all.flatMap((g) => g.overridden));
    }, [languageId]);
    useEffect(() => { load().catch(() => setError(tc("loadFailed"))); }, [load]);   // eslint-disable-line react-hooks/exhaustive-deps

    const changed = useMemo(() => COURSE_FIELDS.filter(({ field }) => JSON.stringify(draft[field.key]) !== JSON.stringify(loaded?.[field.key])), [draft, loaded]);

    const save = async (values: { group: GroupName; key: string; value: SettingValue }[]) => {
        setSaving(true); setError("");
        try {
            for (const g of new Set(values.map((v) => v.group))) {
                await saveSettingsGroup(g, Object.fromEntries(values.filter((v) => v.group === g).map((v) => [v.key, v.value])), languageId);
            }
            await load();
        } catch { setError(tc("saveFailed")); } finally { setSaving(false); }
    };

    return (
        <SectionCard title={tc("course.title")} fold={fold}>
            <p className="text-sm text-muted">{tc("course.description")}</p>
            {languages.length === 0 ? <p className="text-sm text-muted">{tc("course.none")}</p> : (
                <>
                    <ClassicSelectMenu label={tc("course.menu")} options={languages.map((l) => l.name)} selectedOption={languages.find((l) => l.id === languageId)?.name ?? ""}
                        onChange={(name) => setLanguageId(languages.find((l) => l.name === name)?.id)} />
                    {error && <InlineError>{error}</InlineError>}
                    {!loaded ? <p role="status">{tc("loading")}</p> : (
                        <form className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); save(changed.map(({ group, field }) => ({ group, key: field.key, value: draft[field.key] }))); }}>
                            {COURSE_FIELDS.map(({ group, field }) => (
                                <div key={field.key} className="flex flex-col">
                                    <FieldControl field={field} value={draft[field.key]} onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))} disabled={saving} t={label[group]} to={to as never} />
                                    {overridden.includes(field.key) && (
                                        <button type="button" className="self-start text-xs text-muted underline" disabled={saving} onClick={() => save([{ group, key: field.key, value: null }])}>{tc("resetToDefault")}</button>
                                    )}
                                </div>
                            ))}
                            <div className="flex justify-end pt-3"><SaveButton isLoading={saving} onSuccessLabel={tc("saved")} /></div>
                        </form>
                    )}
                </>
            )}
        </SectionCard>
    );
}
