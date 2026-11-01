"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";

// "Shared" marker for language/lesson cards and headers. `count` = people the owner shares with;
// omit it for content someone shared with you. `partial` marks a language only some of whose
// lessons are shared (distinct from a fully shared language).
export default function SharedBadge({ count, fromOwner = false, partial = false, incoming = false }: { count?: number; fromOwner?: boolean; partial?: boolean; incoming?: boolean }) {
  const t = useTranslations("collaboration");
  const word = partial ? "Partial" : "Shared";
  // `incoming`: this (your own) language hosts N lessons other people shared with you
  const label = incoming ? t("incomingSharedLabel", { count: count ?? 0 }) : fromOwner ? t("sharedWithYou") : count ? t("sharedBadgeLabel", { word, count }) : word;
  const title = incoming ? t("incomingSharedTitle", { count: count ?? 0 })
    : fromOwner ? t("sharedWithYou")
    : partial ? t("sharedLabel", { count: count ?? 0 })
    : count ? t("sharedPersonLabel", { count }) : "Shared";
  return (
    <span className="badge w-fit gap-1" title={title}>
      <Users size={12} aria-hidden /> {label}
    </span>
  );
}
