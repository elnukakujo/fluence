import { useTranslations } from "next-intl";
import { Activity, ShieldCheck, Sprout } from "lucide-react";
import type { Tier } from "@/utils/cardTier";

const ICON = { learning: Sprout, practising: Activity, maintaining: ShieldCheck };

/** Names how well the card is known (icon + text), which decides how much help its front gives. */
export default function TierBadge({ tier }: { tier: Tier }) {
    const t = useTranslations("elements");
    const Icon = ICON[tier];
    return <span className="badge self-start" title={t("tierTitle")}><Icon size={13} aria-hidden />{t(`tier_${tier}`)}</span>;
}
