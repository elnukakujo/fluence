import { getTagById } from "@/api/tag";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import NavButton from "@/components/layout/navButton";
import TagCard from "@/components/tags/tagCard";
import { getTranslations } from "next-intl/server";

export default async function TagDetailPage({ params }: { params: Promise<{ tag_id: string }> }) {
    const { tag_id } = await params;
    const tag = await getTagById(tag_id);
    const t = await getTranslations("tags");
    console.log("Tag details:", tag);
    return (
        <main>
            <h1>{t("tagDetail")}</h1>
            <TagCard tag={tag} />
            <span className="flex flex-row gap-4 mt-4">
                <NavButton path={`/tags/${tag_id}/update`}>
                    {t("editTagInformations")}
                </NavButton>
                <DeleteButton element_id={tag_id} />
            </span>
        </main>
    );
}
