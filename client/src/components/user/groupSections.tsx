"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SettingsGroup, { type CourseLanguage } from "./settingsGroup";
import PresetPicker from "./presetPicker";
import { LOCALE_COOKIE } from "@/i18n/locales";

type Props = { languages?: CourseLanguage[] };

/** Group 1: pace. The presets set new/week, reviews/day and the streak minimum; the form below re-reads them. */
export function PaceSection({ languages }: Props) {
    const [version, setVersion] = useState(0);
    return (
        <>
            <PresetPicker onApplied={() => setVersion((v) => v + 1)} />
            <SettingsGroup key={version} group="pace" languages={languages} fields={[
                { key: "streak_min_answers", kind: "number", min: 1, max: 1000 },
                { key: "new_per_week", kind: "number", min: 0, max: 1000 },
                { key: "reviews_per_day", kind: "number", min: 0, max: 1000 },
                { key: "weekly_goals_on", kind: "toggle" },
                { key: "soft_gate", kind: "toggle" },
            ]} />
        </>
    );
}

/** Group 2: what I review (the plan, side mix and boost/ban stay in the Learning section). */
export const ReviewSection = ({ languages }: Props) => (
    <SettingsGroup group="review" languages={languages} fields={[
        { key: "element_types", kind: "multi", options: ["vocabulary", "grammar", "characters", "calligraphy", "exercises", "passages"] },
        { key: "include_shared", kind: "toggle" },
    ]} />
);

/** Group 3: how I answer. */
export const AnswerSection = ({ languages }: Props) => (
    <SettingsGroup group="answer" languages={languages} fields={[
        { key: "hints_enabled", kind: "toggle" },
        { key: "retry_wrong", kind: "toggle" },
        { key: "calligraphy_draw_first", kind: "toggle" },
        { key: "calligraphy_stroke_guide", kind: "toggle" },
        { key: "audio_autoplay", kind: "toggle" },
        { key: "typing_strictness", kind: "choice", options: ["forgiving", "exact"] },
    ]} />
);

/** Group 4: what I see. Interface language and theme live on the account; the browser gets a cookie so the server renders them. */
export function SeeSection({ languages }: Props) {
    const router = useRouter();
    return (
        <SettingsGroup group="see" languages={languages} fields={[
            { key: "show_scores", kind: "toggle" },
            { key: "interface_language", kind: "choice", options: ["en", "fr", "zh"] },
            { key: "theme", kind: "choice", options: ["system", "light", "dark"] },
            { key: "show_phonetics", kind: "choice", options: ["always", "after_reveal", "never"] },
        ]} onSaved={(values) => {
            const secure = "path=/; max-age=31536000; samesite=lax";
            if (typeof values.interface_language === "string") document.cookie = `${LOCALE_COOKIE}=${values.interface_language}; ${secure}`;
            if (typeof values.theme === "string") document.cookie = values.theme === "system" ? "theme=; path=/; max-age=0" : `theme=${values.theme}; ${secure}`;
            if ("interface_language" in values || "theme" in values) router.refresh();
        }} />
    );
}
