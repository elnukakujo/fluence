import SourceForm from "@/components/sources/sourceForm";
import { getTranslations } from "next-intl/server";

export default async function NewSourcesPage() {
    const t = await getTranslations("sources");

    return (
        <main className="flex flex-col gap-4">
            <h1>{t("createNewSource")}</h1>
            <SourceForm />
        </main>
    );
}
