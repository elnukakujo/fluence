import NavButton from "@/components/layout/navButton";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import CollaborateButton from "@/components/collaboration/collaborateButton";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import LanguageStatsPanel from "@/components/language/LanguageStatsPanel";
import { getLanguageData } from "@/api/language";
import { getSharedLessons } from "@/api/lesson";
import { getTodayDailyStats } from "@/api/dailyStats";
import LanguageHeaderCard from "@/components/language/languageHeaderCard";
import LessonsSection from "@/components/language/lessonsSection";
import { getCurrentUserId } from "@/utils/user_cookie";
import ImportButton from "@/components/ingestion/importButton";

export default async function Language({ params }: { params: Promise<{ language_id: string }> }) {
    const { language_id } = await params;
    const { language, lessons } = await getLanguageData(language_id);
    const sharedLessons = (await getSharedLessons()).filter(
        (l) => l.target_iso639_2t === language.target_iso639_2t && l.source_iso639_2t === language.source_iso639_2t
    );
    const allLessons = [...lessons, ...sharedLessons.map((l) => ({ ...l, shared: true }))];
    const userId = await getCurrentUserId();
    const isOwner = userId === language.user_id;
    const dailyStats = language.user_id ? await getTodayDailyStats(language.user_id, language_id) : null;
    const commitmentLog = language.user_id ? await (await import("@/api/commitmentLog")).getCommitmentLogForUserLanguage(language.user_id, language_id) : null;
    const hasLessons = allLessons.length > 0;

    return (
        <main className="flex flex-col space-y-4">
            <header className="flex flex-col gap-4">
                <LanguageHeaderCard language={language} />
                <ElementPerformanceCard element={language} />
                <ElementTagsCard element={language} />
                <ElementSourcesCard element={language} />
                <nav className="flex flex-row flex-wrap gap-2">
                    <NavButton path={`/languages/${language_id}/review`}>
                        <p>Daily Review</p>
                    </NavButton>
                    {language.current_lesson_id && <NavButton path={`/languages/${language_id}/lesson/${language.current_lesson_id}`}>
                        <p>Go to Current Lesson</p>
                    </NavButton>}
                    <NavButton path={`/languages/${language_id}/update`}>
                        <p>Update Language</p>
                    </NavButton>
                    <ImportButton languageId={language_id} label="Import lessons from a document"
                        href={`/languages/${language_id}/import`} settingsHref={`/user/${userId}/update`} />
                    {isOwner && <CollaborateButton targetType="language" targetId={language_id} />}
                    <DeleteButton element_id={language_id}/>
                </nav>
                <LanguageStatsPanel dailyStats={dailyStats} commitmentLog={commitmentLog} />
            </header>
            <article className="flex flex-col space-y-4">
                {hasLessons && (
                    <LessonsSection
                        lessons={allLessons}
                        language_code={language.target_iso639_2t ?? ""}
                    />
                )}

                <NavButton path={`/languages/${language_id}/lesson/new`}>
                    <p>Create New Lesson</p>
                </NavButton>
            </article>
        </main>
    );
}