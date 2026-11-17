import NavButton from "@/components/layout/navButton";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import CollaborateButton from "@/components/collaboration/collaborateButton";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import LanguageStatsPanel from "@/components/language/LanguageStatsPanel";
import { getLanguageData } from "@/api/language";
import { getSharedLessons } from "@/api/lesson";
import { getTodayDailyStats, getHomeStats } from "@/api/dailyStats";
import LanguageHeaderCard from "@/components/language/languageHeaderCard";
import LessonsSection from "@/components/language/lessonsSection";
import { getCurrentUserId } from "@/utils/user_cookie";
import { getStudyGoal } from "@/api/studyGoal";
import ImportButton from "@/components/ingestion/importButton";
import { getTranslations } from "next-intl/server";

export default async function Language({ params }: { params: Promise<{ language_id: string }> }) {
    const t = await getTranslations("languages");
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
    const studyGoal = isOwner ? await getStudyGoal(language_id).catch(() => null) : null;
    const hasLessons = allLessons.length > 0;

    const summary = (await getHomeStats().catch(() => null))?.languages.find((l) => l.id === language_id);
    const tHome = await getTranslations("home");
    const base = `/languages/${language_id}`;
    return (
        <main className="flex flex-col gap-6">
            <LanguageHeaderCard language={language} summary={summary}>
                <nav aria-label={t("studyActions")} className="flex flex-wrap gap-2">
                    <NavButton path={`${base}/review`} className="btn btn-primary min-h-11">
                        <p>{summary ? tHome("reviewNow", { count: summary.due }) : t("dailyReview")}</p>
                    </NavButton>
                    <NavButton path={`${base}/review/by-type`}>
                        <p>{t("reviewByType")}</p>
                    </NavButton>
                    {language.current_lesson_id && <NavButton path={`${base}/lesson/${language.current_lesson_id}`}>
                        <p>{t("goToCurrentLesson")}</p>
                    </NavButton>}
                </nav>
            </LanguageHeaderCard>
            <div className="dash-grid">
                <section className="dash-main" aria-labelledby="lessons-title">
                    <h2 id="lessons-title" className="section-title">{t("lessonsTitle")}</h2>
                    {hasLessons && (
                        <LessonsSection
                            lessons={allLessons}
                            language_code={language.target_iso639_2t ?? ""}
                            languageId={language_id}
                            canManage={isOwner}
                            userId={userId ?? ""}
                        />
                    )}
                    <NavButton path={`${base}/lesson/new`}>
                        <p>{t("createNewLesson")}</p>
                    </NavButton>
                </section>
                <aside className="dash-aside">
                    <LanguageStatsPanel dailyStats={dailyStats} commitmentLog={commitmentLog} studyGoal={studyGoal} settingsHref={`/user/${userId}/update#goals`} />
                    <ElementPerformanceCard element={language} />
                    <ElementTagsCard element={language} />
                    <ElementSourcesCard element={language} />
                    <section className="card flex flex-col gap-3" aria-labelledby="manage-title">
                        <h2 id="manage-title" className="section-title">{t("manage")}</h2>
                        <div className="flex flex-wrap gap-2">
                            <NavButton path={`${base}/update`}>
                                <p>{t("updateLanguage")}</p>
                            </NavButton>
                            <ImportButton languageId={language_id} label={t("importLessonsFromDocument")}
                                href={`${base}/import`} settingsHref={`/user/${userId}/update`} />
                            {isOwner && <CollaborateButton targetType="language" targetId={language_id} />}
                            <DeleteButton element_id={language_id}/>
                        </div>
                    </section>
                </aside>
            </div>
        </main>
    );
}
