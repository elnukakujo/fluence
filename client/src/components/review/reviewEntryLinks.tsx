import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAvailableLanguages } from "@/api/language";
import { queueHref, type ScopeParams } from "@/api/review";
import type Language from "@/interface/containers/Language";
import { getCurrentUserId } from "@/utils/user_cookie";

/** "Review this …" buttons, one per language the learner studies (tags and sources belong to the learner, the queue to a language). */
export default async function ReviewEntryLinks({ scope }: { scope: ScopeParams }) {
    const t = await getTranslations("languages");
    const userId = await getCurrentUserId();
    const languages: Language[] = userId ? await getAvailableLanguages(userId) : [];
    if (languages.length === 0) return null;
    return (
        <section className="mt-4 flex flex-col gap-2">
            <h2 className="font-serif text-lg text-ink">{t("reviewThis")}</h2>
            <ul className="flex list-none flex-wrap gap-3 pl-0">
                {languages.map((l) => (
                    <li key={l.id}><Link className="btn btn-secondary" href={queueHref(l.id!, scope)}>{t("reviewIn", { name: l.name })}</Link></li>
                ))}
            </ul>
        </section>
    );
}
