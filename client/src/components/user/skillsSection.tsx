"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "@/components/ui/sectionCard";
import InlineError from "@/components/ui/inlineError";
import SaveButton from "./saveButton";
import { getSettingsGroup, saveSettingsGroup } from "@/api/settings";

type Matrix = Record<string, string[]>;

/** Which skills to train per element kind (DM-43). At least one stays on; a kind with all its skills on is stored as such. */
export default function SkillsSection() {
    const t = useTranslations("settingsGroups.skills");
    const tc = useTranslations("settingsGroups");
    const [options, setOptions] = useState<Matrix | null>(null);
    const [chosen, setChosen] = useState<Matrix>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        getSettingsGroup("skills").then((g) => {
            const opts = g.options ?? {};
            setOptions(opts);
            const stored = (g.values.enabled_skills ?? {}) as Matrix;
            setChosen(Object.fromEntries(Object.entries(opts).map(([k, all]) => [k, stored[k] ?? all])));
        }, () => setError(tc("loadFailed")));
    }, []);   // eslint-disable-line react-hooks/exhaustive-deps

    const toggle = (kind: string, skill: string) => setChosen((c) => {
        const on = c[kind].includes(skill);
        if (on && c[kind].length === 1) return c;              // never zero skills
        return { ...c, [kind]: on ? c[kind].filter((s) => s !== skill) : [...(options?.[kind] ?? []).filter((s) => s === skill || c[kind].includes(s))] };
    });

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setError("");
        try { await saveSettingsGroup("skills", { enabled_skills: chosen }); } catch { setError(tc("saveFailed")); } finally { setSaving(false); }
    };

    if (!options) return <SectionCard title={t("title")}>{error ? <InlineError>{error}</InlineError> : <p role="status">{tc("loading")}</p>}</SectionCard>;
    return (
        <SectionCard title={t("title")} fold>
            <p className="text-sm text-muted">{t("description")}</p>
            {error && <InlineError>{error}</InlineError>}
            <form onSubmit={save} className="flex flex-col gap-3">
                {Object.entries(options).filter(([, skills]) => skills.length > 1).map(([kind, skills]) => (
                    <fieldset key={kind} className="flex flex-wrap items-center gap-4 border-0 p-0">
                        <legend className="mb-1 text-sm font-medium">{t(`kinds.${kind}`)}</legend>
                        {skills.map((skill) => (
                            <label key={skill} className="flex min-h-11 items-center gap-2 text-sm">
                                <input type="checkbox" checked={chosen[kind]?.includes(skill) ?? false} onChange={() => toggle(kind, skill)} disabled={saving} />
                                {t(`skill.${skill}`)}
                            </label>
                        ))}
                    </fieldset>
                ))}
                <div className="flex justify-end"><SaveButton isLoading={saving} onSuccessLabel={tc("saved")} /></div>
            </form>
        </SectionCard>
    );
}
