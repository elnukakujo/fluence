export type ElementKind =
    | "language" | "lesson" | "vocabulary" | "grammar" | "calligraphy" | "exercise"
    | "character" | "word" | "passage" | "tag" | "source";

export type ElementKindInfo = {
    prefix: string;
    kind: ElementKind;
    deleter?: (id: string) => Promise<unknown>;
    skills?: readonly string[]; // slot for the target domain, unread today
};

// One map for id-prefix -> element kind; the backend's ElementKind registry (element_kinds.py) mirrors it.
// Deleters import lazily so this module loads without pulling every api/* module (and its fetch chain).
const KINDS: ElementKindInfo[] = [
    { prefix: "lang_", kind: "language", deleter: (id) => import("./language").then((m) => m.deleteLanguage(id)) },
    { prefix: "lesson_", kind: "lesson", deleter: (id) => import("./lesson").then((m) => m.deleteLesson(id)) },
    { prefix: "voc_", kind: "vocabulary", deleter: (id) => import("./vocabulary").then((m) => m.deleteVocabulary(id)) },
    { prefix: "gram_", kind: "grammar", deleter: (id) => import("./grammar").then((m) => m.deleteGrammar(id)) },
    { prefix: "call_", kind: "calligraphy", deleter: (id) => import("./calligraphy").then((m) => m.deleteCalligraphy(id)) },
    { prefix: "ex_", kind: "exercise", deleter: (id) => import("./exercise").then((m) => m.deleteExercise(id)) },
    { prefix: "char_", kind: "character" },
    { prefix: "word_", kind: "word" },
    { prefix: "pass_", kind: "passage" },
    { prefix: "tag_", kind: "tag", deleter: (id) => import("./tag").then((m) => m.deleteTag(id)) },
    { prefix: "src_", kind: "source", deleter: (id) => import("./source").then((m) => m.deleteSource(id)) },
];

export function elementKindOf(id: string): ElementKindInfo | undefined {
    if (!id) return undefined;
    const lower = id.toLowerCase();
    return KINDS.find((k) => lower.startsWith(k.prefix));
}
