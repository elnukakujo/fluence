import TagForm from "@/components/tags/tagForm";
import { getTagById } from "@/api/tag";
import { getTranslations } from "next-intl/server";

export default async function UpdateTagPage({ params }: { params: Promise<{ tag_id: string }> }) {
    const { tag_id } = await params;
    const tag = await getTagById(tag_id);
    const t = await getTranslations("tags");
    return (
        <main className="flex flex-col gap-4">
            <h1>{t("updateTag")}</h1>
            <TagForm tag={tag} />
        </main>
    );
}
