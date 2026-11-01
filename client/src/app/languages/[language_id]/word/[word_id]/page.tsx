import { getWordById } from "@/api/word";
import type Word from "@/interface/components/Word";
import type Character from "@/interface/components/Character";
import type Passage from "@/interface/components/Passage";
import WordCard from "@/components/elements/wordCard";
import RelatedCard from "@/components/elements/relatedCard";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import { getTranslations } from "next-intl/server";

export default async function WordPage({
  params,
}: {
  params: Promise<{ language_id: string; word_id: string }>;
}) {
  const t = await getTranslations("languages");
  const { word_id, language_id } = await params;
  const word = (await getWordById(word_id)) as Word & {
    characters?: Partial<Character>[];
    passages?: Partial<Passage>[];
  };

  return (
    <main>
      <article className="flex flex-col space-y-4">
        <h1>{t("wordSheet")}</h1>
        <WordCard word={word} />

        <RelatedCard
          languageId={language_id}
          characters={word.characters}
          passages={word.passages}
        />

        <ElementTagsCard element={word} />
        <ElementSourcesCard element={word} />
        <ElementPerformanceCard element={word} />
      </article>
      <nav className="flex flex-row space-x-4">
        <DeleteButton element_id={word.id!}>{t("deleteWordButton")}</DeleteButton>
      </nav>
    </main>
  );
}
