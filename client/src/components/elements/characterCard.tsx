import Link from "next/link";
import { useTranslations } from "next-intl";
import Character, { type CharacterRef } from "@/interface/components/Character";
import ElementMediaCard from "./elementMediaCard";

type Ref = CharacterRef;

export default function CharacterCard({ character, hiddenTranslation, hiddenAdditionalInformations, languageId, components, radicalOf, componentOf, keyRadical, review }: { review?: boolean; character: Character | Partial<Character>; hiddenTranslation?: boolean; hiddenAdditionalInformations?: boolean; languageId?: string; components?: Ref[]; radicalOf?: Ref[]; componentOf?: Ref[]; keyRadical?: Ref | null }) {
    const t = useTranslations("elements");
    const showExtras =
        (hiddenTranslation && hiddenAdditionalInformations) || !hiddenTranslation;
    const hasMedia =
        (character.image_files && character.image_files.length > 0) ||
        (character.audio_files && character.audio_files.length > 0);
    if (review) {
        const kr = keyRadical ?? character.key_radical;
        return (
            <section className="card flex flex-col items-center gap-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">{t("characterHeading")}</p>
                <span className="font-serif text-6xl font-semibold leading-none text-foreground sm:text-7xl">{character.character}</span>
                {showExtras && character.phonetic && <span className="chip pointer-events-none font-mono text-base">/{character.phonetic}/</span>}
                {!hiddenTranslation && character.meaning && <p className="text-xl font-medium text-foreground">{character.meaning}</p>}
                {showExtras && (character.readings?.length ?? 0) > 1 && (
                    <p className="font-mono text-sm text-muted">{character.readings!.map((r) => `${r.kind} ${r.value}`).join(" · ")}</p>
                )}
                <CharacterStructure tiles keyRadical={kr} components={components ?? character.component_refs} />
                {showExtras && !kr && character.radical && <span className="chip pointer-events-none">{character.radical}</span>}
                {showExtras && character.strokes ? <span className="text-sm text-muted">{t("strokeCount", { n: character.strokes })}</span> : null}
                {hasMedia && <ElementMediaCard element={character} />}
            </section>
        );
    }
    return (
        <section className="card">
            <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{t("characterHeading")}</h2>
                {/* status badges (not links): this character is also a radical / a component of others */}
                {(radicalOf?.length ?? 0) > 0 && <span className="chip pointer-events-none border border-accent">{t("characterRadicalBadge")}</span>}
                {(componentOf?.length ?? 0) > 0 && <span className="chip pointer-events-none border border-accent">{t("characterComponentBadge")}</span>}
            </div>
            <div className="index-divider pt-3 flex flex-col space-y-4">
                {/* ── Main character row ──────────────────────────────────────────── */}
                <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-serif text-2xl font-semibold text-foreground">
                        {character.character}
                    </span>
                    {showExtras && character.phonetic && (
                            <span className="font-mono text-sm text-muted">
                                /{character.phonetic}/
                            </span>
                    )}
                    {!hiddenTranslation && character.meaning && (
                        <span className="font-mono text-sm text-muted">{character.meaning}</span>
                    )}
                </div>

                {/* ── Meta chips ────────────────────────────────────────────── */}
                {showExtras && (character.strokes || (character.radical && !(keyRadical ?? character.key_radical))) && (
                <div className="flex flex-wrap gap-2">
                    {character.strokes && (
                    <span className="chip pointer-events-none">{t("strokeCount", { n: character.strokes })}</span>
                    )}
                    {!(keyRadical ?? character.key_radical) && character.radical && (
                    <span className="chip pointer-events-none">{character.radical}</span>
                    )}
                </div>
                )}

                {showExtras && (character.readings?.length ?? 0) > 1 && (
                    <p className="font-mono text-sm text-muted">
                        {t("characterReadings")}: {character.readings!.map((r) => `${r.kind} ${r.value}`).join(" · ")}
                    </p>
                )}

                <CharacterStructure languageId={languageId} keyRadical={keyRadical ?? character.key_radical} components={components ?? character.component_refs}
                    radicalOf={radicalOf} componentOf={componentOf} />

                {hasMedia && <ElementMediaCard element={character} />}
            </div>
        </section>
    );
}

/** What a character is built from and what is built on it: Key radical, Components, Radical of, Component of. Links to the sheets when
 *  a language id is known; plain characters otherwise (in a review the learner must not be sent away mid-session). */
export function CharacterStructure({ languageId, keyRadical, components, radicalOf, componentOf, tiles }: {
    tiles?: boolean; languageId?: string; keyRadical?: Ref | null; components?: Ref[]; radicalOf?: Ref[]; componentOf?: Ref[];
}) {
    const t = useTranslations("elements");
    const rows: [string, Ref[] | undefined][] = [
        [t("characterKeyRadical"), keyRadical ? [keyRadical] : undefined],
        [t("characterComponents"), components],
        [t("characterRadicalOf"), radicalOf],
        [t("characterComponentOf"), componentOf],
    ];
    const shown = rows.filter(([, refs]) => refs?.length);
    if (shown.length === 0) return null;
    if (tiles) return (
        // review cards: labelled tiles with large glyphs, one row that wraps (plain characters: a review is never left)
        <dl className="flex w-full flex-wrap justify-center gap-3">
            {shown.map(([label, refs]) => (
                <div key={label} className="flex min-w-32 flex-1 flex-col items-center gap-2 rounded-xl border border-border px-3 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted">{label}</dt>
                    <dd className="flex flex-wrap justify-center gap-2">
                        {refs!.map((r) => <span key={r.id} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-accent px-2 font-serif text-3xl text-foreground">{r.character}</span>)}
                    </dd>
                </div>
            ))}
        </dl>
    );
    return (
        <dl className="flex flex-col gap-2 rounded-xl border border-border p-3">
            {shown.map(([label, refs]) => (
                <div key={label} className="flex flex-wrap items-baseline gap-2">
                    <dt className="min-w-28 text-sm text-muted">{label}</dt>
                    <dd className="flex flex-wrap gap-2">
                        {refs!.map((r) => languageId
                            ? <Link key={r.id} href={`/languages/${languageId}/character/${r.id}`} className="chip font-serif text-xl">{r.character}</Link>
                            : <span key={r.id} className="chip pointer-events-none font-serif text-xl">{r.character}</span>)}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
