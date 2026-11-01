import { getSourceById } from "@/api/source";
import SourceForm from "@/components/sources/sourceForm";
import { getTranslations } from "next-intl/server";

export default async function UpdateSourcePage({ params }: { params: Promise<{ source_id: string }> }) {
    const { source_id } = await params;
    const source = await getSourceById(source_id);
    const t = await getTranslations("sources");
    return (
        <main className="flex flex-col gap-4">
            <h1>{t("updateSource")}</h1>
            <SourceForm source={source} />
        </main>
    );
}
