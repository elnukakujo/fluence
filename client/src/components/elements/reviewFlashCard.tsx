import ReviewSession from "@/components/review/ReviewSession";
import type { ReviewCard } from "@/api/review";

/** Thin re-export: the daily-review shell now lives in `components/review/ReviewSession`. */
export default function ReviewFlashCard({ cards, languageId }: { cards: ReviewCard[]; languageId?: string }) {
    return <ReviewSession items={cards} options={{ languageId }} />;
}
