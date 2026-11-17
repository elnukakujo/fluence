"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "@/components/ui/sectionCard";
import InlineError from "@/components/ui/inlineError";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
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

    const pick = (kind: string, skills: string[]) => {       // never zero skills; the menu keeps the order of the matrix
        if (skills.length) setChosen((c) => ({ ...c, [kind]: (options?.[kind] ?? []).filter((x) => skills.includes(x)) }));
    };

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
                    <ClassicSelectMenu key={kind} multiple label={t(`kinds.${kind}`)} options={skills} optionLabel={(o) => t(`skill.${o}`)}
                        selectedOption={chosen[kind] ?? []} onChange={(v) => pick(kind, v as string[])} disabled={saving} className="w-full max-w-sm" />
                ))}
                <div className="flex justify-end"><SaveButton isLoading={saving} onSuccessLabel={tc("saved")} /></div>
            </form>
        </SectionCard>
    );
}
