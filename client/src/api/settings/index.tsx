import { apiFetch } from "@/api/apiFetch";

export type GroupName = "pace" | "review" | "answer" | "see" | "skills";
export type SettingValue = boolean | number | string | string[] | Record<string, string[]> | null;
export type SettingsGroup = {
    values: Record<string, SettingValue>;
    scopes: Record<string, "account" | "course">;
    overridden: string[];
    options?: Record<string, string[]>;   // skills: the skills each element kind offers
};

export const getSettingsGroup = (group: GroupName, languageId?: string): Promise<SettingsGroup> =>
    apiFetch(`/api/pref/settings/${group}${languageId ? `?language_id=${languageId}` : ""}`, { errorMessage: "Could not load these settings" });

/** Updates only the given keys of one group; a course key needs the language, `null` on it removes the override. */
export const saveSettingsGroup = (group: GroupName, values: Record<string, SettingValue>, languageId?: string): Promise<SettingsGroup> =>
    apiFetch(`/api/pref/settings/${group}`, { method: "PUT", body: { values, language_id: languageId }, errorMessage: "Could not save these settings" });
