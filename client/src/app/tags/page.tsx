import { redirect } from "next/navigation";
import { getAllUserTags } from "@/api/tag";
import Tag from "@/interface/systemData/Tag";
import MergeableList from "@/components/labels/mergeableList";
import NavButton from "@/components/layout/navButton";
import { getCurrentUserId } from "@/utils/user_cookie";
import { getTranslations } from "next-intl/server";

export default async function TagsPage() {
    const userId: string | null = await getCurrentUserId();
    if (!userId) redirect('/');
    const tags: Tag[] = await getAllUserTags(userId);
    const t = await getTranslations("tags");

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-baseline">
                <h1>{t("tags")}</h1>
                <NavButton path="/tags/new">{t("newTag")}</NavButton>
            </div>

            <MergeableList kind="tag" empty={<p className="text-muted">{t("noTagsYet")}</p>}
                items={tags.map((x) => ({ id: x.id, label: x.name, color: x.color, description: x.description }))} />
        </div>
    );
}