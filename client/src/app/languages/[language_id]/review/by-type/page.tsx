import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { queueHref } from "@/api/review";

// Each choice opens the same queue page with a `type` scope; radicals are the characters that are some character's key radical.
const TYPES = [
    { type: "vocabulary" }, { type: "grammar" }, { type: "calligraphy" }, { type: "character" },
    { type: "character", radicals: true }, { type: "exercise" },
] as const;

export default async function ReviewByTypePage({ params }: { params: Promise<{ language_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id } = await params;
    return (
        <main>
            <h1>{t("reviewByType")}</h1>
            <p className="text-muted">{t("reviewByTypeHint")}</p>
            <ul className="mt-4 flex flex-wrap gap-3">
                {TYPES.map((x) => (
                    <li key={`${x.type}${"radicals" in x ? "-radicals" : ""}`}>
                        <Link className="btn btn-secondary" href={queueHref(language_id, { scope: "type", type: x.type, radicals: "radicals" in x })}>
                            {t(`typeLabel.${x.type}${"radicals" in x ? "Radicals" : ""}`)}
                        </Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
