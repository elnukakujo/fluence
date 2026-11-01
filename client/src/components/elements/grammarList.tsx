"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import NavButton from "@/components/layout/navButton";
import Grammar from "@/interface/features/Grammar";
import DifficultyDisplay from "@/components/ui/displays/difficultyDisplay";
import ScoreDisplay from "@/components/ui/displays/scoreDisplay";

export default function GrammarList({ gramProps}: { gramProps: Grammar[]}) {
    const t = useTranslations("grammar");
    const { language_id, lesson_id } = useParams<{ language_id: string, lesson_id: string }>();

    const router = useRouter();
    const handleClick = (id: string) => {
        router.push(`/languages/${language_id}/lesson/${lesson_id}/gram/${id}`);
    };

    const averageScore = gramProps.reduce((acc, item) => acc + item.score!, 0) / gramProps.length;
    const averageDifficulty = gramProps.reduce((acc, item) => acc + item.difficulty!, 0) / gramProps.length;

    gramProps.sort((a, b) => (a.score || 0) - (b.score || 0));

    return (
        <section className="card flex flex-col gap-4 w-[14rem] h-fit">
            <header>
                <h2>{t("heading")}</h2>
                {gramProps.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted">{t("total")}: {gramProps.length}</span>
                        <ScoreDisplay score={averageScore} />
                        <DifficultyDisplay difficulty={averageDifficulty} />
                    </div>
                )}
            </header>
            {gramProps.length === 0 ? <p>{t("emptyState")}</p> :
                <ul className="index-divider list-item pl-5 space-y-1 list-none">
                    {gramProps.map((item, index) => (
                        <li key={index}>
                            <button 
                                onClick={() => handleClick(item.id!)} 
                                className="text-left link">
                                {item.title}
                            </button>
                        </li>
                    ))}
                </ul>
            }
            <NavButton
                path = {`/languages/${language_id}/lesson/${lesson_id}/gram/new`}
            >
                <span>{t("addNewButton")}</span>
            </NavButton>

            {gramProps.length > 0 && (
                <NavButton
                    path={`/languages/${language_id}/lesson/${lesson_id}/gram/flashcard`}
                >
                    <p>{t("practiceButton")}</p>
                </NavButton>)
            }
        </section>
    );
}