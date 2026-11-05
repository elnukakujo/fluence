import { useTranslations } from "next-intl";
import Word from "@/interface/components/Word";
import ElementMediaCard from "./elementMediaCard";

export default function WordCard({
  word,
  hiddenTranslation,
  hiddenAdditionalInformations,
  reverse,
}: {
  word: Word | Partial<Word>;
  hiddenTranslation?: boolean;
  hiddenAdditionalInformations?: boolean;
  /** Back side of a vocabulary card: while hidden, show the translation instead of the word. */
  reverse?: boolean;
}) {
  const t = useTranslations("elements");
  const showExtras =
    ((hiddenTranslation && hiddenAdditionalInformations) || !hiddenTranslation) && !(reverse && hiddenTranslation);
  const hasMedia =
    (word.image_files && word.image_files.length > 0) ||
    (word.audio_files && word.audio_files.length > 0);

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-semibold">{t("wordHeading")}</h2>

      <div className="index-divider pt-3 flex flex-col gap-4">

        {/* ── Main word row ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-serif text-2xl font-semibold text-foreground">
            {reverse && hiddenTranslation ? word.translation : word.word}
          </span>
          {showExtras && word.phonetic && (
            <span className="font-mono text-sm text-muted">
              /{word.phonetic}/
            </span>
          )}
          {!hiddenTranslation && word.translation && (
            <span className="font-mono text-sm text-muted">{word.translation}</span>
          )}
        </div>

        {/* ── Meta chips ────────────────────────────────────────────── */}
        {showExtras && (word.word_type || word.word_gender) && (
          <div className="flex flex-wrap gap-2">
            {word.word_type && (
              <span className="chip pointer-events-none">{word.word_type}</span>
            )}
            {word.word_gender && (
              <span className="chip pointer-events-none">{word.word_gender}</span>
            )}
          </div>
        )}

        {/* ── Media ─────────────────────────────────────────────────── */}
        {hasMedia && !(reverse && hiddenTranslation) && <ElementMediaCard element={word} />}

      </div>
    </section>
  );
}