"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SettingsGroup from "./settingsGroup";
import PresetPicker from "./presetPicker";
import { LOCALE_COOKIE } from "@/i18n/locales";

/** Learning pace: the presets set the streak minimum (and the new/reviews numbers they carry); the form re-reads after one is applied. */
export function PaceBlock() {
    const [version, setVersion] = useState(0);
    return (
        <div className="flex flex-col gap-5">
            <SettingsGroup key={version} group="pace" fields={[
                { key: "daily_goal_minutes", kind: "number", min: 5, max: 60, step: 5 },
                { key: "streak_min_answers", kind: "number", min: 1, max: 1000 },
            ]} />
            <PresetPicker onApplied={() => setVersion((v) => v + 1)} />
        </div>
    );
}

/** Appearance: interface language and theme live on the account; the browser gets a cookie so the server renders them. */
export function AppearanceBlock() {
    const router = useRouter();
    return (
        <SettingsGroup group="see" fields={[
            { key: "interface_language", kind: "choice", options: ["en", "fr", "zh"] },
            { key: "theme", kind: "choice", options: ["system", "light", "dark"] },
            { key: "show_scores", kind: "toggle" },
        ]} onSaved={(values) => {
            const secure = "path=/; max-age=31536000; samesite=lax";
            if (typeof values.interface_language === "string") document.cookie = `${LOCALE_COOKIE}=${values.interface_language}; ${secure}`;
            if (typeof values.theme === "string") document.cookie = values.theme === "system" ? "theme=; path=/; max-age=0" : `theme=${values.theme}; ${secure}`;
            if ("interface_language" in values || "theme" in values) router.refresh();
        }} />
    );
}

/** How I answer (account-wide). */
export const AnswerBlock = () => (
    <SettingsGroup group="answer" fold fields={[
        { key: "hints_enabled", kind: "toggle" },
        { key: "retry_wrong", kind: "toggle" },
        { key: "calligraphy_draw_first", kind: "toggle" },
        { key: "calligraphy_stroke_guide", kind: "toggle" },
        { key: "audio_autoplay", kind: "toggle" },
    ]} />
);
