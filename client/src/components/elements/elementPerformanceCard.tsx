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
    const params = useParams();
    const language_id = params?.language_id as string;
    const [language_iso639_1, setLanguageIso639_1] = useState<string>("");

    useEffect(() => {
        if (!('level' in element)) return;

        getLanguageById(language_id).then(lang => {
            setLanguageIso639_1(lang.target_iso639_2t as string);
        });
    }, []);

    return (
        <section className="card flex flex-col space-y-2">
            <h3>{t("performanceInfo")}</h3>
            <div className="index-divider pt-3 flex flex-col space-y-2">
                {'level' in element && (
                    <LevelDisplay language_iso639_1={language_iso639_1} levelIdx={element.level as number}/>
                )}
                {'score' in element && (element as any).score != null && (
                    <ScoreDisplay score={(element as any).score} />
                )}
                {'difficulty' in element && (element as any).difficulty != null && (
                    <DifficultyDisplay difficulty={(element as any).difficulty} />
                )}
                {'created_at' in element && (element as any).created_at != null && (
                    <DateDisplay date={(element as any).created_at} message={t("createdOn")} />
                )}
                {'last_seen_at' in element && (element as any).last_seen_at != null && (
                    <DateDisplay date={(element as any).last_seen_at} message={t("lastSeenOn")} />
                )}
            </div>
        </section>
    );
}