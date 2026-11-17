"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "@/components/ui/sectionCard";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import InlineError from "@/components/ui/inlineError";
import ToggleRow from "./toggleRow";
import SaveButton from "./saveButton";
import { type GroupName, type SettingValue, getSettingsGroup, saveSettingsGroup } from "@/api/settings";

export type Field =
    | { key: string; kind: "toggle" }
    | { key: string; kind: "number"; min: number; max: number; step?: number }
    | { key: string; kind: "choice"; options: string[] }
    | { key: string; kind: "multi"; options: string[] };

export type CourseLanguage = { id: string; name: string };

/** One settings group: loads it (for the chosen course when it has course-scope settings), edits the fields, and saves only what changed
 *  (US-R3: saving one group never touches another). Labels come from `settingsGroups.<group>.<key>` / `<key>Desc`. */
export default function SettingsGroup({ group, fields, languages = [], onSaved, extra }: {
    group: GroupName;
    fields: Field[];
    languages?: CourseLanguage[];
    onSaved?: (values: Record<string, SettingValue>) => void;
    extra?: React.ReactNode;
}) {
    const t = useTranslations(`settingsGroups.${group}`);
    const to = useTranslations("settingsGroups.options");
    const tc = useTranslations("settingsGroups");
    const [languageId, setLanguageId] = useState<string | undefined>(languages[0]?.id);
    const [loaded, setLoaded] = useState<Record<string, SettingValue> | null>(null);
    const [draft, setDraft] = useState<Record<string, SettingValue>>({});
    const [overridden, setOverridden] = useState<string[]>([]);
    const [scopes, setScopes] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const apply = useCallback((g: { values: Record<string, SettingValue>; overridden: string[]; scopes: Record<string, string> }) => {
        setLoaded(g.values); setDraft(g.values); setOverridden(g.overridden); setScopes(g.scopes);
    }, []);

    const hasCourse = fields.some((f) => scopes[f.key] === "course");
    useEffect(() => {
        getSettingsGroup(group, languageId).then(apply, () => setError(tc("loadFailed")));
    }, [group, languageId, apply]);   // eslint-disable-line react-hooks/exhaustive-deps

    const changed = useMemo(() => Object.keys(draft).filter((k) => fields.some((f) => f.key === k) && JSON.stringify(draft[k]) !== JSON.stringify(loaded?.[k])), [draft, loaded, fields]);

    const save = async (values: Record<string, SettingValue>) => {
        setSaving(true); setError("");
        try { apply(await saveSettingsGroup(group, values, languageId)); onSaved?.(values); }
        catch { setError(tc("saveFailed")); }
        finally { setSaving(false); }
    };

    const set = (key: string, value: SettingValue) => setDraft((d) => ({ ...d, [key]: value }));

    if (!loaded) return <SectionCard title={t("title")}>{error ? <InlineError>{error}</InlineError> : <p role="status">{tc("loading")}</p>}</SectionCard>;

    return (
        <SectionCard title={t("title")}>
            <p className="text-sm text-muted">{t("description")}</p>
            {hasCourse && languages.length > 0 && (
                <ClassicSelectMenu
                    label={tc("course")}
                    options={languages.map((l) => l.name)}
                    selectedOption={languages.find((l) => l.id === languageId)?.name ?? ""}
                    onChange={(name) => setLanguageId(languages.find((l) => l.name === name)?.id)}
                />
            )}
            {error && <InlineError>{error}</InlineError>}
            <form className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); save(Object.fromEntries(changed.map((k) => [k, draft[k]]))); }}>
                {fields.map((f) => {
                    const course = scopes[f.key] === "course";
                    if (course && !languageId) return null;
                    const reset = course && overridden.includes(f.key)
                        ? <button type="button" className="text-xs text-muted underline" disabled={saving} onClick={() => save({ [f.key]: null })}>{tc("resetToDefault")}</button> : null;
                    return (
                        <div key={f.key} className="flex flex-col">
                            {f.kind === "toggle" && (
                                <ToggleRow label={t(f.key)} description={t(`${f.key}Desc`)} checked={Boolean(draft[f.key])} onChange={(v) => set(f.key, v)} disabled={saving} />
                            )}
                            {f.kind === "number" && (
                                <label className="flex items-center justify-between gap-3 py-2.5">
                                    <span className="flex flex-col"><span className="text-sm font-medium">{t(f.key)}</span><span className="text-xs text-muted">{t(`${f.key}Desc`)}</span></span>
                                    <input type="number" className="input w-24" min={f.min} max={f.max} step={f.step ?? 1} value={Number(draft[f.key] ?? 0)}
                                        onChange={(e) => set(f.key, Number(e.target.value))} disabled={saving} />
                                </label>
                            )}
                            {(f.kind === "choice" || f.kind === "multi") && (
                                <div className="flex flex-col gap-1 py-2.5">
                                    <ClassicSelectMenu
                                        label={t(f.key)}
                                        options={f.options}
                                        optionLabel={(o) => to(o)}
                                        multiple={f.kind === "multi"}
                                        selectedOption={f.kind === "multi" ? ((draft[f.key] as string[] | undefined) ?? []) : String(draft[f.key] ?? "")}
                                        onChange={(v) => set(f.key, v as SettingValue)}
                                        disabled={saving}
                                    />
                                    <span className="text-xs text-muted">{t(`${f.key}Desc`)}</span>
                                </div>
                            )}
                            {reset}
                        </div>
                    );
                })}
                {extra}
                <div className="flex justify-end pt-3"><SaveButton isLoading={saving} onSuccessLabel={tc("saved")} /></div>
            </form>
        </SectionCard>
    );
}
