"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Ban, Plus, Rocket, X } from "lucide-react";
import SectionCard from "./sectionCard";
import SaveButton from "./saveButton";
import { updateUserPreferences } from "@/api/userPreferences";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import { SIDE_PRESETS, parseCycle, presetKeyOf, ratioPattern, type SidePresetKey } from "@/utils/sidePattern";
import type UserPreferences from "@/interface/systemData/UserPreferences";
import type { ReviewSection, VocSidePattern } from "@/interface/systemData/UserPreferences";

const SECTION_TYPES: ReviewSection["type"][] = ["voc", "gram", "ex", "call"];
type Mode = "boost" | "ban";

/** Vocabulary front/back mix, exercise-type boost / ban, and the ordered daily-review sections. */
export default function StudyPreferencesSection({ preferences }: { preferences: Partial<UserPreferences> }) {
    const t = useTranslations("study");
    const tEx = useTranslations("exercises");
    const stored = preferences.voc_side_pattern ?? null;
    const [preset, setPreset] = useState<SidePresetKey | "custom">(presetKeyOf(stored));
    const [ratio, setRatio] = useState({ front: stored?.mode === "random" ? stored.front : 1, back: stored?.mode === "random" ? stored.back : 1 });
    const [cycleText, setCycleText] = useState(stored?.mode === "cycle" ? stored.cycle.join("") : "FFB");
    const [customKind, setCustomKind] = useState<"ratio" | "cycle">(stored?.mode === "cycle" ? "cycle" : "ratio");
    const [typePrefs, setTypePrefs] = useState<Record<string, Mode>>(preferences.exercise_type_prefs ?? {});
    const [layout, setLayout] = useState<ReviewSection[] | null>(preferences.review_layout ?? null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const customPattern = (): VocSidePattern | null =>
        customKind === "ratio" ? ratioPattern(ratio.front, ratio.back) : (parseCycle(cycleText) ? { mode: "cycle", cycle: parseCycle(cycleText)! } : null);
    const pattern = preset === "custom" ? customPattern() : SIDE_PRESETS[preset];

    const setMode = (type: string, mode: Mode) =>
        setTypePrefs((p) => { const next = { ...p }; if (next[type] === mode) delete next[type]; else next[type] = mode; return next; });
    const move = (i: number, d: -1 | 1) =>
        setLayout((l) => { const n = [...l!]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
    const missing = SECTION_TYPES.filter((s) => !layout?.some((x) => x.type === s));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pattern) { setError(t("invalidPattern")); return; }
        setError("");
        setSaving(true);
        try {
            await updateUserPreferences(preferences.id!, { voc_side_pattern: pattern, exercise_type_prefs: typePrefs, review_layout: layout && layout.length ? layout : null });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SectionCard title={t("title")}>
            <form onSubmit={submit} className="flex flex-col gap-6">
                <fieldset className="flex flex-col gap-2">
                    <legend className="text-sm opacity-70">{t("vocabMix")}</legend>
                    <div className="filter-chips">
                        {([...Object.keys(SIDE_PRESETS), "custom"] as (SidePresetKey | "custom")[]).map((k) => (
                            <button key={k} type="button" aria-pressed={preset === k} className={`filter-chip ${preset === k ? "active" : ""}`} onClick={() => setPreset(k)}>
                                {t(`preset_${k}`)}
                            </button>
                        ))}
                    </div>
                    {preset === "custom" && (
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="filter-chips">
                                {(["ratio", "cycle"] as const).map((k) => (
                                    <button key={k} type="button" aria-pressed={customKind === k} className={`filter-chip ${customKind === k ? "active" : ""}`} onClick={() => setCustomKind(k)}>{t(`custom_${k}`)}</button>
                                ))}
                            </div>
                            {customKind === "ratio" ? (
                                <>
                                    <label className="flex items-center gap-2 text-sm">{t("front")}
                                        <input type="number" min={0} className="input w-16 text-center" value={ratio.front} onChange={(e) => setRatio({ ...ratio, front: Number(e.target.value) })} />
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">{t("back")}
                                        <input type="number" min={0} className="input w-16 text-center" value={ratio.back} onChange={(e) => setRatio({ ...ratio, back: Number(e.target.value) })} />
                                    </label>
                                </>
                            ) : (
                                <label className="flex items-center gap-2 text-sm">{t("cycleLabel")}
                                    <input className="input w-32 font-mono" value={cycleText} onChange={(e) => setCycleText(e.target.value)} placeholder="FFB" />
                                </label>
                            )}
                        </div>
                    )}
                    <p className="text-sm text-muted">{t("vocabMixHint")}</p>
                </fieldset>

                <fieldset className="flex flex-col gap-2">
                    <legend className="text-sm opacity-70">{t("exerciseTypes")}</legend>
                    <ul className="flex flex-col gap-2 list-none pl-0">
                        {Object.keys(EXERCISE_TYPE_KEY).map((type) => (
                            <li key={type} className="flex flex-wrap items-center justify-between gap-2">
                                <span>{tEx(EXERCISE_TYPE_KEY[type])}</span>
                                <span className="filter-chips">
                                    <button type="button" aria-pressed={typePrefs[type] === "boost"} className={`filter-chip inline-flex items-center gap-1 min-h-11 ${typePrefs[type] === "boost" ? "active" : ""}`} onClick={() => setMode(type, "boost")}>
                                        <Rocket size={14} aria-hidden />{t("boost")}
                                    </button>
                                    <button type="button" aria-pressed={typePrefs[type] === "ban"} className={`filter-chip inline-flex items-center gap-1 min-h-11 ${typePrefs[type] === "ban" ? "active" : ""}`} onClick={() => setMode(type, "ban")}>
                                        <Ban size={14} aria-hidden />{t("ban")}
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-sm text-muted">{t("exerciseTypesHint")}</p>
                </fieldset>

                <fieldset className="flex flex-col gap-2">
                    <legend className="text-sm opacity-70">{t("reviewLayout")}</legend>
                    {layout === null ? (
                        <button type="button" className="btn btn-secondary self-start min-h-11" onClick={() => setLayout(SECTION_TYPES.map((type) => ({ type, minutes: null })))}>{t("customizeLayout")}</button>
                    ) : (
                        <>
                            <ol className="flex flex-col gap-2 list-none pl-0">
                                {layout.map((sec, i) => (
                                    <li key={sec.type} className="flex flex-wrap items-center gap-2">
                                        <span className="badge">{i + 1}</span>
                                        <span className="min-w-24">{t(`section_${sec.type}`)}</span>
                                        <label className="flex items-center gap-1 text-sm">
                                            <input type="number" min={1} className="input w-16 text-center" aria-label={t("minutesFor", { section: t(`section_${sec.type}`) })} value={sec.minutes ?? ""} placeholder="–"
                                                onChange={(e) => setLayout(layout.map((s, j) => j === i ? { ...s, minutes: e.target.value ? Number(e.target.value) : null } : s))} />
                                            {t("minutes")}
                                        </label>
                                        <button type="button" className="btn btn-secondary min-h-11 min-w-11" aria-label={t("moveUp")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} aria-hidden /></button>
                                        <button type="button" className="btn btn-secondary min-h-11 min-w-11" aria-label={t("moveDown")} disabled={i === layout.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} aria-hidden /></button>
                                        <button type="button" className="btn btn-secondary min-h-11 min-w-11" aria-label={t("removeSection")} onClick={() => setLayout(layout.filter((_, j) => j !== i))}><X size={16} aria-hidden /></button>
                                    </li>
                                ))}
                            </ol>
                            <div className="flex flex-wrap gap-2">
                                {missing.map((s) => (
                                    <button key={s} type="button" className="filter-chip inline-flex items-center gap-1 min-h-11" onClick={() => setLayout([...layout, { type: s, minutes: null }])}>
                                        <Plus size={14} aria-hidden />{t(`section_${s}`)}
                                    </button>
                                ))}
                                <button type="button" className="btn btn-secondary min-h-11" onClick={() => setLayout(null)}>{t("defaultLayout")}</button>
                            </div>
                        </>
                    )}
                    <p className="text-sm text-muted">{t("reviewLayoutHint")}</p>
                </fieldset>

                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <div><SaveButton isLoading={saving} /></div>
            </form>
        </SectionCard>
    );
}
