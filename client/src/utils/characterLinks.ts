import type Character from "@/interface/components/Character";

/** The key radicals of some characters, resolved against the language's characters (`all`, from `listCharacters`), without repeats.
 *  ponytail: one list call per page; a `radicals` field on the word/passage payloads would save it if the lists get long. */
export function radicalsOf(characters: Partial<Character>[] = [], all: Partial<Character>[] = []): Partial<Character>[] {
    const byId = new Map(all.map((c) => [c.id, c]));
    const seen = new Set<string>();
    const out: Partial<Character>[] = [];
    for (const c of characters) {
        const full = (c.id && byId.get(c.id)) || c;
        const radical = full.key_radical_id ? byId.get(full.key_radical_id) : undefined;
        if (radical?.id && !seen.has(radical.id)) { seen.add(radical.id); out.push(radical); }
    }
    return out;
}
