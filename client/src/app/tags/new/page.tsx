import TagForm from "@/components/tags/tagForm";
import { getTranslations } from "next-intl/server";

export default async function NewTagsPage() {
    const t = await getTranslations("tags");

    return (
        <main className="flex flex-col gap-4">
            <h1>{t("createNewTag")}</h1>
            <TagForm />
        </main>
    );
}