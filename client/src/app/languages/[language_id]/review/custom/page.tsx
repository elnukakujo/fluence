import { getTranslations } from "next-intl/server";
import { getSettingsGroup } from "@/api/settings";
import { getAllUserSources } from "@/api/source";
import { getAllUserTags } from "@/api/tag";
import { getTypeStats } from "@/api/dailyStats";
import { getCurrentUserId } from "@/utils/user_cookie";
import CustomReviewPicker from "@/components/review/customReviewPicker";
import type Tag from "@/interface/systemData/Tag";
import type Source from "@/interface/systemData/Source";

// Characters and radicals are calligraphy cards and passages are components, so only these four are studied (RE-14).
const TYPES = ["vocabulary", "grammar", "calligraphy", "exercise"] as const;

export default async function CustomReviewPage({ params }: { params: Promise<{ language_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id } = await params;
    const userId = await getCurrentUserId();
    const [settings, sources, tags, stats] = await Promise.all([
        getSettingsGroup("review", language_id).catch(() => null),
        userId ? getAllUserSources(userId).catch(() => []) : [],
        userId ? getAllUserTags(userId).catch(() => []) : [],
        getTypeStats(language_id).catch(() => null),
    ]);
    const studied = (settings?.values.element_types as string[] | undefined) ?? [];   // the course's own choice
    const types = TYPES.filter((type) => !studied.length || studied.includes(type === "exercise" ? "exercises" : type));
    return (
        <main className="flex flex-col gap-4">
            <header className="page-head">
                <div>
                    <h1>{t("reviewCustom")}</h1>
                    <p className="text-muted">{t("reviewCustomHint")}</p>
                </div>
            </header>
            <CustomReviewPicker languageId={language_id} types={[...types]} stats={stats}
                sources={(sources as Source[]).map((s) => ({ id: s.id, label: s.title }))}
                tags={(tags as Tag[]).map((g) => ({ id: g.id, label: g.name, color: g.color }))} />
        </main>
    );
}
