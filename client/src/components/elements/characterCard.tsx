import { useTranslations } from "next-intl";
import Character from "@/interface/components/Character";
import ElementMediaCard from "./elementMediaCard";

export default function CharacterCard({ character, hiddenTranslation, hiddenAdditionalInformations }: { character: Character | Partial<Character>; hiddenTranslation?: boolean; hiddenAdditionalInformations?: boolean }) {
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
                    {character.radical && (
                    <span className="chip pointer-events-none">{character.radical}</span>
                    )}
                </div>
                )}

                {hasMedia && <ElementMediaCard element={character} />}
            </div>
        </section>
    );
}