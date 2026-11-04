import { getTranslations } from "next-intl/server";
import type Exercise from "@/interface/features/Exercise";

/** Badge for an exercise that still needs something from the user before it can be practised. */
export default async function NeedsBadge({ exercise }: { exercise: Exercise }) {
    if (!exercise.needs?.length) return null;
    const t = await getTranslations("exercises");
    return <span className="badge self-start">{t("needsAudio")}</span>;
}
