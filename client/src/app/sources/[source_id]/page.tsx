import { getSourceById } from "@/api/source";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import NavButton from "@/components/layout/navButton";
import SourceCard from "@/components/sources/sourceCard";
import { getTranslations } from "next-intl/server";

export default async function SourceDetailPage({ params }: { params: Promise<{ source_id: string }> }) {
    const { source_id } = await params;
    const source = await getSourceById(source_id);
    const t = await getTranslations("sources");
    return (
        <main>
            <h1>{t("sourceDetail")}</h1>
            <SourceCard source={source} />
            <span className="flex flex-row gap-4 mt-4">
                <NavButton path={`/sources/${source_id}/update`}>
                    {t("editSourceInformations")}
                </NavButton>
                <DeleteButton element_id={source_id} />
            </span>
        </main>
    );
}
