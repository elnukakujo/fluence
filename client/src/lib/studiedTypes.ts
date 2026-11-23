import { getSettingsGroup } from "@/api/settings";

/** The types a course studies (SG-14): its "Element types" setting, every type when none is set or the setting cannot be read. */
export const ALL_TYPES = ["vocabulary", "grammar", "calligraphy", "exercises"];

export async function getStudiedTypes(languageId: string): Promise<string[]> {
    const v = (await getSettingsGroup("review", languageId).catch(() => null))?.values.element_types;
    return Array.isArray(v) && v.length ? (v as string[]) : ALL_TYPES;
}

/** A lesson's elements without the types the course does not study: an exercise is never offered a link to them. */
export function studiedElements<V, G, C>(types: string[], e: { vocabularies: V[]; grammars: G[]; calligraphies: C[] }): { vocabularies?: V[]; grammars?: G[]; calligraphies?: C[] } {
    return {
        vocabularies: types.includes("vocabulary") ? e.vocabularies : undefined,
        grammars: types.includes("grammar") ? e.grammars : undefined,
        calligraphies: types.includes("calligraphy") ? e.calligraphies : undefined,
    };
}
