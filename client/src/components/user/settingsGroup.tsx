"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "@/components/ui/sectionCard";
import InlineError from "@/components/ui/inlineError";
import FieldControl, { type Field } from "./fieldControl";
import SaveButton from "./saveButton";
import { type GroupName, type SettingValue, getSettingsGroup, saveSettingsGroup } from "@/api/settings";

export type { Field } from "./fieldControl";

/** The account-level fields of one settings group: loads them, edits them, and saves only what changed (saving one group never
 *  touches another). Labels come from `settingsGroups.<group>.<key>` / `<key>Desc`. Per-course settings live in `CourseSettings`. */
export default function SettingsGroup({ group, fields, onSaved, extra, lead, quiet = false, fold = false, autosave = false, describe = true }: {
    group: GroupName;
    fields: Field[];
    onSaved?: (values: Record<string, SettingValue>) => void;
    extra?: React.ReactNode;
    lead?: React.ReactNode | ((fill: (values: Record<string, SettingValue>) => void) => React.ReactNode);   // above the fields (e.g. the presets, which only fill the form)
    describe?: boolean;           // show the group's one-line description
    autosave?: boolean;           // discrete controls only: each change is saved at once, no Save button
    quiet?: boolean;
    fold?: boolean;
}) {
    const t = useTranslations(`settingsGroups.${group}`);
    const to = useTranslations("settingsGroups.options");
    const tc = useTranslations("settingsGroups");
    const [loaded, setLoaded] = useState<Record<string, SettingValue> | null>(null);
    const [draft, setDraft] = useState<Record<string, SettingValue>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const apply = useCallback((g: { values: Record<string, SettingValue> }) => { setLoaded(g.values); setDraft(g.values); }, []);
    useEffect(() => { getSettingsGroup(group).then(apply, () => setError(tc("loadFailed"))); }, [group, apply]);   // eslint-disable-line react-hooks/exhaustive-deps

    const changed = useMemo(() => fields.map((f) => f.key).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(loaded?.[k])), [draft, loaded, fields]);

    const save = async (values: Record<string, SettingValue>) => {
        setSaving(true); setError("");
        try { apply(await saveSettingsGroup(group, values)); onSaved?.(values); }
        catch { setError(tc("saveFailed")); }
        finally { setSaving(false); }
    };

    if (!loaded) return <SectionCard title={t("title")} quiet={quiet} fold={fold}>{error ? <InlineError>{error}</InlineError> : <p role="status">{tc("loading")}</p>}</SectionCard>;

    return (
        <SectionCard title={t("title")} quiet={quiet} fold={fold}>
            {describe && <p className="text-sm text-muted">{t("description")}</p>}
            {error && <InlineError>{error}</InlineError>}
            <form className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); save(Object.fromEntries(changed.map((k) => [k, draft[k]]))); }}>
                {typeof lead === "function" ? lead((values) => setDraft((d) => ({ ...d, ...values }))) : lead}
                {fields.map((f) => (
                    <FieldControl key={f.key} field={f} value={draft[f.key]} disabled={saving} t={t} to={to}
                        onChange={(v) => { setDraft((d) => ({ ...d, [f.key]: v })); if (autosave) save({ [f.key]: v }); }} />
                ))}
                {extra}
                {autosave ? <p role="status" className="sr-only">{saving ? tc("loading") : ""}</p> : <div className="flex justify-end pt-3"><SaveButton isLoading={saving} onSuccessLabel={tc("saved")} /></div>}
            </form>
        </SectionCard>
    );
}
