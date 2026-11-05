'use client';

import { useState, useEffect } from "react";
import { useParams } from 'next/navigation';
import { useTranslations } from "next-intl";
import { BaseElement } from "@/interface/base";
import { getLanguageById } from "@/api/language";
import { languageProficiencySystems } from "@/utils/language_iso639";
import DifficultyDisplay from "@/components/ui/displays/difficultyDisplay";
import ScoreDisplay from "../ui/displays/scoreDisplay";
import LevelDisplay from "../ui/displays/levelDisplay";
import DateDisplay from "../ui/displays/dateDisplay";

export default function ElementPerformanceCard({ element }: { element: BaseElement }) {
    const t = useTranslations("elements");
    const tUi = useTranslations("ui");
    const params = useParams();
    const language_id = params?.language_id as string;
    const [language_iso639_1, setLanguageIso639_1] = useState<string>("");

    useEffect(() => {
        if (!('level' in element)) return;

        getLanguageById(language_id).then(lang => {
            setLanguageIso639_1(lang.target_iso639_2t as string);
        });
    }, []);

    const e = element as unknown as Record<string, unknown>;
    // one row per score/difficulty pair: just the element, or overall + front + back for two-sided vocabulary
    const sided = "front_score" in e;
    const rows = [
        ...(sided || "score" in e || "difficulty" in e ? [{ key: "all", label: sided ? t("average") : "", score: e.score as number | null | undefined, difficulty: e.difficulty as number | null | undefined }] : []),
        ...(sided ? (["front", "back"] as const).map((side) => ({ key: side, label: t(side), score: e[`${side}_score`] as number, difficulty: e[`${side}_difficulty`] as number })) : []),
    ];
    const hasDates = e.created_at != null || e.last_seen_at != null;

    return (
        <section className="card flex flex-col gap-3">
            <h3>{t("performanceInfo")}</h3>
            <div className="index-divider" />
            {'level' in element && (
                <LevelDisplay language_iso639_1={language_iso639_1} levelIdx={element.level as number}/>
            )}
            {rows.length > 0 && (
                <div className={`grid items-center gap-x-6 gap-y-2 ${sided ? "grid-cols-[auto_1fr_1fr]" : "grid-cols-[1fr_1fr]"}`}>
                    {sided && <span aria-hidden />}
                    <span className="text-xs uppercase tracking-wide text-muted">{tUi("score")}</span>
                    <span className="text-xs uppercase tracking-wide text-muted">{tUi("difficulty")}</span>
                    {rows.map((r) => (
                        <div key={r.key} className="contents">
                            {sided && <span className="text-sm text-muted">{r.label}</span>}
                            {r.score != null ? <ScoreDisplay score={r.score} hideLabel /> : <span className="text-sm text-muted">–</span>}
                            {r.difficulty != null ? <DifficultyDisplay difficulty={r.difficulty} hideLabel /> : <span className="text-sm text-muted">–</span>}
                        </div>
                    ))}
                </div>
            )}
            {hasDates && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    {e.created_at != null && <DateDisplay date={e.created_at as string} message={t("createdOn")} />}
                    {e.last_seen_at != null && <DateDisplay date={e.last_seen_at as string} message={t("lastSeenOn")} />}
                </div>
            )}
        </section>
    );
}
