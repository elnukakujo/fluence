import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { queueHref } from "@/api/review";

// Each choice opens the same queue page with a `type` scope. Characters and radicals are calligraphy cards, so they have no chip of their own.
const TYPES = ["vocabulary", "grammar", "calligraphy", "exercise"] as const;

export default async function ReviewByTypePage({ params }: { params: Promise<{ language_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id } = await params;
    return (
        <main>
            <h1>{t("reviewByType")}</h1>
            <p className="text-muted">{t("reviewByTypeHint")}</p>
            <ul className="mt-4 flex list-none flex-wrap gap-3 pl-0">
                {TYPES.map((type) => (
                    <li key={type}>
                        <Link className="btn btn-secondary" href={queueHref(language_id, { scope: "type", type })}>{t(`typeLabel.${type}`)}</Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
