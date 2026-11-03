"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SelectBox, SelectToggle, useItemSelection } from "@/components/elements/itemSelection";
import NavButton from "@/components/layout/navButton";

import Vocabulary from "@/interface/features/Vocabulary";
import DifficultyDisplay from "@/components/ui/displays/difficultyDisplay";
import ScoreDisplay from "@/components/ui/displays/scoreDisplay";

export default function VocabularyList({ vocProps}: { vocProps: Vocabulary[]}) {
    const t = useTranslations("vocabulary");
    const { language_id, lesson_id } = useParams<{ language_id: string, lesson_id: string }>();

    const sel = useItemSelection();
    const router = useRouter();
    const handleClick = (id: string) => {
        router.push(`/languages/${language_id}/lesson/${lesson_id}/voc/${id}`);
    };

    const averageScore = vocProps.reduce((acc, item) => acc + item.score!, 0) / vocProps.length;
    const averageDifficulty = vocProps.reduce((acc, item) => acc + item.difficulty!, 0) / vocProps.length;

    vocProps.sort((a, b) => (a.score || 0) - (b.score || 0));

    return (
        <section className="card flex flex-col gap-4 w-[14rem] h-fit">
            <header>
                <h2>{t("heading")}</h2>
                {vocProps.length > 0 && <SelectToggle />}
                {vocProps.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted">{t("total")}: {vocProps.length}</span>
                        <ScoreDisplay score={averageScore} />
                        <DifficultyDisplay difficulty={averageDifficulty} />
                    </div>
                )}
            </header>
            {vocProps.length === 0 ? <p>{t("emptyState")}</p> :
                <ul className="index-divider list-item pl-5 space-y-1 list-none">
                    {vocProps.map((item, index) => (
                        <li key={index}>
                            {sel.active ? <SelectBox id={item.id!}>{item.word.word} –{" "}{item.word.translation}</SelectBox> : (
                                <button onClick={() => handleClick(item.id!)} className="text-left link">{item.word.word} –{" "}{item.word.translation}</button>
                            )}
                        </li>
                    ))}
                </ul>
            }
            <NavButton
                path = {`/languages/${language_id}/lesson/${lesson_id}/voc/new`}
            >
                <p>{t("addNewButton")}</p>
            </NavButton>
            {vocProps.length > 0 && (
                <NavButton
                    path={`/languages/${language_id}/lesson/${lesson_id}/voc/flashcard`}
                >
                    <p>{t("practiceButton")}</p>
                </NavButton>
            )}
        </section>
    );
}