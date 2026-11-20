"use client";

import SettingsGroup from "./settingsGroup";

/** Appearance: the score after each answer, saved as you pick. Interface language and theme live in the top bar. */
export function AppearanceBlock() {
    return (
        <SettingsGroup group="see" autosave describe={false} fields={[{ key: "show_scores", kind: "toggle" }]} />
    );
}

/** How I answer (account-wide): hints, retries, drawing and audio. */
export const AnswerBlock = () => (
    <SettingsGroup group="answer" fold fields={[
        { key: "hints_enabled", kind: "toggle" },
        { key: "retry_wrong", kind: "toggle" },
        { key: "calligraphy_draw_first", kind: "toggle" },
        { key: "calligraphy_stroke_guide", kind: "toggle" },
        { key: "audio_autoplay", kind: "toggle" },
    ]} />
);
