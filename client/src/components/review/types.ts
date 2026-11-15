import type { ReviewCard } from "@/api/review";

export type SessionItem = ReviewCard;

export type SessionOptions = {
    languageId?: string;
    completeOnFinish?: boolean;
    timeBudget?: number;
    tierVisibility?: boolean;
    enabledSkills?: readonly string[];
};
