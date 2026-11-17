"use client";

import SettingsGroup from "./settingsGroup";
import PresetPicker from "./presetPicker";

/** Learning pace: the three numbers you choose (new per week, reviews per day, answers for a streak day). A preset only fills them in; nothing is saved (and no
 *  goal changes) until Save. */
export function PaceBlock() {
    return (
        <SettingsGroup group="pace" quiet describe={false} onSaved={() => window.dispatchEvent(new Event("study-goals-changed"))}   // the goal card re-reads its suggestion; no goal changes
            lead={(fill, draft) => <PresetPicker onPick={fill} current={draft} />}
            fields={[
                { key: "new_per_week", kind: "number", min: 0, max: 1000 },
                { key: "reviews_per_day", kind: "number", min: 0, max: 1000 },
                { key: "streak_min_answers", kind: "number", min: 1, max: 1000 },
            ]} />
    );
}

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
