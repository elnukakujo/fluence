import Link from "next/link";
import { useTranslations } from "next-intl";
import Character, { type CharacterRef } from "@/interface/components/Character";
import ElementMediaCard from "./elementMediaCard";

type Ref = CharacterRef;

export default function CharacterCard({ character, hiddenTranslation, hiddenAdditionalInformations, languageId, components, radicalOf, componentOf, keyRadical }: { character: Character | Partial<Character>; hiddenTranslation?: boolean; hiddenAdditionalInformations?: boolean; languageId?: string; components?: Ref[]; radicalOf?: Ref[]; componentOf?: Ref[]; keyRadical?: Ref | null }) {
    const t = useTranslations("elements");
    const showExtras =
        (hiddenTranslation && hiddenAdditionalInformations) || !hiddenTranslation;
    const hasMedia =
        (character.image_files && character.image_files.length > 0) ||
        (character.audio_files && character.audio_files.length > 0);
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
                {showExtras && (character.strokes || (character.radical && !keyRadical)) && (
                <div className="flex flex-wrap gap-2">
                    {character.strokes && (
                    <span className="chip pointer-events-none">{t("strokeCount", { n: character.strokes })}</span>
                    )}
                    {!keyRadical && character.radical && (
                    <span className="chip pointer-events-none">{character.radical}</span>
                    )}
                </div>
                )}

                {showExtras && (character.readings?.length ?? 0) > 1 && (
                    <p className="font-mono text-sm text-muted">
                        {t("characterReadings")}: {character.readings!.map((r) => `${r.kind} ${r.value}`).join(" · ")}
                    </p>
                )}

                {/* ── Structure: what it is built from, then what is built on it ── */}
                {(() => {
                    const rows: [string, Ref[] | undefined][] = [
                        [t("characterKeyRadical"), keyRadical ? [keyRadical] : undefined],
                        [t("characterComponents"), components],
                        [t("characterRadicalOf"), radicalOf],
                        [t("characterComponentOf"), componentOf],
                    ];
                    const shown = rows.filter(([, refs]) => refs?.length);
                    return shown.length > 0 ? (
                        <dl className="flex flex-col gap-2 rounded-xl border border-border p-3">
                            {shown.map(([label, refs]) => (
                                <div key={label} className="flex flex-wrap items-baseline gap-2">
                                    <dt className="min-w-28 text-sm text-muted">{label}</dt>
                                    <dd className="flex flex-wrap gap-2">
                                        {refs!.map((r) => (
                                            <Link key={r.id} href={`/languages/${languageId}/character/${r.id}`} className="chip font-serif text-xl">{r.character}</Link>
                                        ))}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    ) : null;
                })()}

                {hasMedia && <ElementMediaCard element={character} />}
            </div>
        </section>
    );
}