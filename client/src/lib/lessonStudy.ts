import type Vocabulary from "@/interface/features/Vocabulary";
import type { VocSidePattern } from "@/interface/systemData/UserPreferences";
import { splitPattern } from "@/utils/sidePattern";

function shuffle<T>(items: T[], rng: () => number): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Lesson study asks every word on both sides, ordered by the user's "order" setting: random (the default) shuffles all the cards,
 *  blocks asks all fronts then all backs, alternate follows the front/back ratio in turns. Every side is its own card (`card_id` "<id>#<side>"). */
export function orderVocabulary(vocabularies: Vocabulary[], pattern: VocSidePattern | null | undefined, rng: () => number = Math.random): Vocabulary[] {
    const { front, back, order } = splitPattern(pattern);
    const side = (s: "front" | "back") => vocabularies.map((v) => ({ ...v, side: s, card_id: `${v.id}#${s}` }));
    const fronts = side("front"), backs = side("back");
    if (order === "random") return shuffle([...fronts, ...backs], rng);
    if (order === "blocks") return [...fronts, ...backs];
    const out: Vocabulary[] = [];
    let f = 0, b = 0;
    while (f < fronts.length && b < backs.length) {
        for (let i = 0; i < front && f < fronts.length; i++) out.push(fronts[f++]);
        for (let i = 0; i < back && b < backs.length; i++) out.push(backs[b++]);
    }
    return [...out, ...fronts.slice(f), ...backs.slice(b)];
}

/** Grammar and calligraphy have one side: shuffled under the (default) random order, lesson order otherwise. */
export function orderSingleSided<T>(items: T[], pattern: VocSidePattern | null | undefined, rng: () => number = Math.random): T[] {
    return splitPattern(pattern).order === "random" ? shuffle(items, rng) : items;
}
