import ReviewSession from "@/components/review/ReviewSession";
import { getQueue } from "@/api/review";
import { scopeFromQuery } from "@/utils/reviewScope";
import { getTranslations } from "next-intl/server";

type Q = Record<string, string | string[] | undefined>;

export default async function ReviewQueuePage({ params, searchParams }: { params: Promise<{ language_id: string }>; searchParams: Promise<Q> }) {
    const t = await getTranslations("languages");
    const { language_id } = await params;
    const scope = scopeFromQuery(await searchParams);
    const items = await getQueue(language_id, scope);
    return (
        <main>
            <h1>{t(`queueTitle.${scope.scope}`)}</h1>
            <ReviewSession items={items} options={{ languageId: language_id }} />
        </main>
    );
}
