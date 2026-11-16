import Link from "next/link";
import { useTranslations } from "next-intl";
import Character, { type CharacterRef } from "@/interface/components/Character";
import ElementMediaCard from "./elementMediaCard";

type Ref = CharacterRef;

export default function CharacterCard({ character, hiddenTranslation, hiddenAdditionalInformations, languageId, components, usedIn, keyRadical }: { character: Character | Partial<Character>; hiddenTranslation?: boolean; hiddenAdditionalInformations?: boolean; languageId?: string; components?: Ref[]; usedIn?: Ref[]; keyRadical?: Ref | null }) {
    const t = useTranslations("elements");
    const showExtras =
        (hiddenTranslation && hiddenAdditionalInformations) || !hiddenTranslation;
    const hasMedia =
        (character.image_files && character.image_files.length > 0) ||
        (character.audio_files && character.audio_files.length > 0);
    return (
        <section className="card">
            <h2 className="mb-1 text-lg font-semibold">{t("characterHeading")}</h2>
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
                {showExtras && (character.strokes || character.radical) && (
                <div className="flex flex-wrap gap-2">
                    {character.strokes && (
                    <span className="chip pointer-events-none">{t("strokeCount", { n: character.strokes })}</span>
                    )}
                    {keyRadical ? (
                    <Link href={`/languages/${languageId}/character/${keyRadical.id}`} className="chip" title={t("characterKeyRadical")}>{keyRadical.character}</Link>
                    ) : character.radical && (
                    <span className="chip pointer-events-none">{character.radical}</span>
                    )}
                </div>
                )}

                {showExtras && (character.readings?.length ?? 0) > 1 && (
                    <p className="font-mono text-sm text-muted">
                        {t("characterReadings")}: {character.readings!.map((r) => `${r.kind} ${r.value}`).join(" · ")}
                    </p>
                )}
                {[[t("characterComponents"), components], [t("characterUsedIn"), usedIn]].map(([label, refs]) =>
                    (refs as Ref[] | undefined)?.length ? (
                        <div key={label as string} className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm text-muted">{label as string}</span>
                            {(refs as Ref[]).map((r) => (
                                <Link key={r.id} href={`/languages/${languageId}/character/${r.id}`} className="chip font-serif">{r.character}</Link>
                            ))}
                        </div>
                    ) : null,
                )}

                {hasMedia && <ElementMediaCard element={character} />}
            </div>
        </section>
    );
}