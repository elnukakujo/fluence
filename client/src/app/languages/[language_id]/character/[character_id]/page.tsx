import { getCharacterById } from "@/api/character";
import type Character from "@/interface/components/Character";
import type Word from "@/interface/components/Word";
import type Passage from "@/interface/components/Passage";
import CharacterCard from "@/components/elements/characterCard";
import RelatedCard from "@/components/elements/relatedCard";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import { getTranslations } from "next-intl/server";

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ language_id: string; character_id: string }>;
}) {
  const t = await getTranslations("languages");
  const { character_id, language_id } = await params;
  const character = (await getCharacterById(character_id)) as Character & {
    words?: Partial<Word>[];
    passages?: Partial<Passage>[];
  };

  const glyph = async (id: string) => ({ id, character: ((await getCharacterById(id)) as Character).character });
  const components = await Promise.all((character.components ?? []).map(glyph));
  const usedIn = await Promise.all((character.used_in ?? []).map(glyph));

  return (
    <main>
      <article className="flex flex-col space-y-4">
        <h1>{t("characterSheet")}</h1>
        <CharacterCard character={character} languageId={language_id} components={components} usedIn={usedIn} />

        <RelatedCard
          languageId={language_id}
          words={character.words}
          passages={character.passages}
        />

        <ElementTagsCard element={character} />
        <ElementSourcesCard element={character} />
        <ElementPerformanceCard element={character} />
      </article>
      <nav className="flex flex-row space-x-4">
        <DeleteButton element_id={character.id!}>{t("deleteCharacterButton")}</DeleteButton>
      </nav>
    </main>
  );
}
