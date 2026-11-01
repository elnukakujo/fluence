"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import NavButton from "@/components/layout/navButton";
import type Calligraphy from "@/interface/features/Calligraphy";
import DifficultyDisplay from "@/components/ui/displays/difficultyDisplay";
import ScoreDisplay from "@/components/ui/displays/scoreDisplay";

export default function CalligraphyList({ callProps}: { callProps: Calligraphy[]}) {
    const t = useTranslations("calligraphy");
    const { language_id, lesson_id } = useParams<{ language_id: string, lesson_id: string }>();

    const router = useRouter();
    const handleClick = (id: string) => {
        router.push(`/languages/${language_id}/lesson/${lesson_id}/call/${id}`);
    };

    const averageScore = callProps.reduce((acc, item) => acc + item.score!, 0) / callProps.length;
    const averageDifficulty = callProps.reduce((acc, item) => acc + item.difficulty!, 0) / callProps.length;

    callProps.sort((a, b) => (a.score || 0) - (b.score || 0));

    return (
        <section className="card flex flex-col gap-4 w-[14rem] h-fit">
            <header>
                <h2>{t("heading")}</h2>
                {callProps.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted">{t("total")}: {callProps.length}</span>
                        <ScoreDisplay score={averageScore} />
                        <DifficultyDisplay difficulty={averageDifficulty} />
                    </div>
                )}
            </header>
            {callProps.length === 0 ? <p>{t("emptyState")}</p> :
                <ul className="index-divider list-item pl-5 space-y-1 list-none">
                    {callProps.map((item, index) => (
                        <li key={index}>
                            <button 
                                onClick={() => handleClick(item.id!)} 
                                className="text-left link">
                                {item.character.character} –{" "}{item.character.phonetic}
                            </button>
                        </li>
                    ))}
                </ul>
            }
            <NavButton
                path = {`/languages/${language_id}/lesson/${lesson_id}/call/new`}
            >
                <span>{t("addNewButton")}</span>
            </NavButton>
            {callProps.length > 0 && (
            <NavButton
                path={`/languages/${language_id}/lesson/${lesson_id}/call/flashcard`}
            >
                <p>{t("practiceCardButton")}</p>
            </NavButton>)}
        </section>
    );
}