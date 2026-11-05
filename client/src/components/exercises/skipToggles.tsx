"use client";

import { useTranslations } from "next-intl";
import { EarOff, MicOff } from "lucide-react";
import type { Skips } from "@/utils/exerciseSkills";

/** "I can't hear" / "I can't speak": session-only switches that skip the matching exercises. */
export default function SkipToggles({ value, onChange, skippedCount }: { value: Skips; onChange: (next: Skips) => void; skippedCount: number }) {
    const t = useTranslations("exercises");
    const btn = (key: keyof Skips, label: string, Icon: typeof EarOff) => (
        <button type="button" aria-pressed={value[key]} className={`filter-chip inline-flex items-center gap-1 min-h-11 ${value[key] ? "active" : ""}`}
            onClick={() => onChange({ ...value, [key]: !value[key] })}>
            <Icon size={14} aria-hidden />{label}
        </button>
    );
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="filter-chips">{btn("hear", t("cantHear"), EarOff)}{btn("speak", t("cantSpeak"), MicOff)}</div>
            <p role="status" className="text-sm text-muted">{skippedCount > 0 ? t("skippedCount", { count: skippedCount }) : ""}</p>
        </div>
    );
}
