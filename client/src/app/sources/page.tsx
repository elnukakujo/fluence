import { redirect } from "next/navigation";
import { getAllUserSources } from "@/api/source";
import MergeableList from "@/components/labels/mergeableList";
import NavButton from "@/components/layout/navButton";
import Source from "@/interface/systemData/Source";
import { getCurrentUserId } from "@/utils/user_cookie";
import { getTranslations } from "next-intl/server";

export default async function SourcesPage() {
    const userId: string | null = await getCurrentUserId();
    if (!userId) redirect('/');
    const sources: Source[] = await getAllUserSources(userId);
    const t = await getTranslations("sources");

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-baseline">
                <h1>{t("sources")}</h1>
                <NavButton path="/sources/new">{t("newSource")}</NavButton>
            </div>

            <MergeableList kind="source" empty={<p className="text-muted">{t("noSourcesYet")}</p>}
                items={sources.map((x) => ({ id: x.id, label: x.title, description: x.description }))} />
        </div>
    );
}