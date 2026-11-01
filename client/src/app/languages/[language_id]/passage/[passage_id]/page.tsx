import { getPassageById } from "@/api/passage";
import type Passage from "@/interface/components/Passage";
import type Word from "@/interface/components/Word";
import type Character from "@/interface/components/Character";
import SentenceCard from "@/components/elements/sentenceCard";
import RelatedCard from "@/components/elements/relatedCard";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import { getTranslations } from "next-intl/server";

export default async function PassagePage({
  params,
}: {
  params: Promise<{ language_id: string; passage_id: string }>;
}) {
  const t = await getTranslations("languages");
  const { passage_id, language_id } = await params;
  const passage = (await getPassageById(passage_id)) as Passage & {
    words?: Partial<Word>[];
    characters?: Partial<Character>[];
  };

  return (
    <main>
      <article className="flex flex-col space-y-4">
        <h1>{t("passageSheet")}</h1>
        <SentenceCard sentence={passage} />

        <RelatedCard
          languageId={language_id}
          words={passage.words}
          characters={passage.characters}
        />

        <ElementTagsCard element={passage} />
        <ElementSourcesCard element={passage} />
        <ElementPerformanceCard element={passage} />
      </article>
      <nav className="flex flex-row space-x-4">
        <DeleteButton element_id={passage.id!}>{t("deletePassageButton")}</DeleteButton>
      </nav>
    </main>
  );
}
