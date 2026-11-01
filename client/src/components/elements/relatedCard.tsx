import Link from "next/link";
import { useTranslations } from "next-intl";
import type Word from "@/interface/components/Word";
import type Character from "@/interface/components/Character";
import type Passage from "@/interface/components/Passage";

type RelatedCardProps = {
  languageId: string;
  words?: Partial<Word>[];
  characters?: Partial<Character>[];
  passages?: Partial<Passage>[];
};

function getHref(languageId: string, item: Partial<Word> | Partial<Character> | Partial<Passage>, kind: "word" | "character" | "passage") {
  const itemLanguageId = item.language_id ?? languageId;
  return `/languages/${itemLanguageId}/${kind}/${item.id}`;
}

export default function RelatedCard({ languageId, words = [], characters = [], passages = [] }: RelatedCardProps) {
  const t = useTranslations("elements");
  const groups = [
    {
      title: t("relatedWords"),
      kind: "word" as const,
      items: words,
      label: (item: Partial<Word>) => item.word ?? "",
    },
    {
      title: t("relatedCharacters"),
      kind: "character" as const,
      items: characters,
      label: (item: Partial<Character>) => item.character ?? "",
    },
    {
      title: t("relatedPassages"),
      kind: "passage" as const,
      items: passages,
      label: (item: Partial<Passage>) => item.text ?? "",
    },
  ].filter((group) => group.items.length > 0);

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-semibold">{t("relatedComponentsHeading")}</h2>
      {groups.length > 0 ? (
        <div className="index-divider pt-3 flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {group.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item, index) => {
                  const href = getHref(languageId, item, group.kind);
                  const label = group.label(item as never);
                  if (!item.id || !label) {
                    return null;
                  }

                  return (
                    <Link
                      key={`${group.kind}-${item.id}-${index}`}
                      href={href}
                      className="chip"
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="index-divider pt-3 text-sm text-muted">{t("noRelatedComponents")}</p>
      )}
    </section>
  );
}
