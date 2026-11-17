"use client";

import { useState } from "react";
import SettingsGroup from "./settingsGroup";
import PresetPicker from "./presetPicker";
import { setThemeCookie } from "./theme";

/** Learning pace: daily minutes and streak minimum, with the presets as the quick way to fill them (applied at once; the form re-reads). */
export function PaceBlock() {
    const [version, setVersion] = useState(0);
    return (
        <SettingsGroup key={version} group="pace" quiet describe={false}
            lead={<PresetPicker onApplied={() => setVersion((v) => v + 1)} />}
            fields={[
                { key: "daily_goal_minutes", kind: "number", min: 5, max: 60, step: 5 },
                { key: "streak_min_answers", kind: "number", min: 1, max: 1000 },
            ]} />
    );
}

/** Appearance: theme (kept on the account, mirrored in a cookie so the server renders it) and the score after each answer. Saved as you
 *  pick, no button. The interface language stays in the top bar. */
export function AppearanceBlock() {
    return (
        <SettingsGroup group="see" autosave quiet describe={false} fields={[{ key: "theme", kind: "choice", options: ["system", "light", "dark"] }, { key: "show_scores", kind: "toggle" }]}
            onSaved={(values) => { if (typeof values.theme === "string") setThemeCookie(values.theme); }} />
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
