import ReviewFlashCard from "@/components/elements/reviewFlashCard";
import { getReviewCards } from "@/api/review";
import { getTranslations } from "next-intl/server";

export default async function ReviewPage({ params }: { params: Promise<{ language_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id } = await params;
    const cards = await getReviewCards(language_id);

    return (
        <main>
            <h1>{t("dailyReview")}</h1>
            <ReviewFlashCard cards={cards} />
        </main>
    );
}
