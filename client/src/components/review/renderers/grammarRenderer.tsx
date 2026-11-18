import type Grammar from "@/interface/features/Grammar";
import GrammarCard from "@/components/elements/grammarCard";
import FlipCard from "../FlipCard";
import NonVocabExamples from "./NonVocabExamples";
import type { ItemRenderer } from "../types";

export const grammarRenderer: ItemRenderer<Grammar> = {
    kindKey: "section_gram",
    view: () => ({ tier: null, showDetail: false, listenFirst: false, choiceActive: false, typedMode: false }),
    body: (c) => (
        <FlipCard hidden={c.hiddenTranslation} onReveal={() => { c.reveal(); c.grade(1); }}   // reading is not recall: no self-grade, flipping the point counts as a full grade
            front={<h3 className="font-serif">{c.item.title}</h3>}
            back={<GrammarCard grammar={c.item} />} />
    ),
    post: (c) => <NonVocabExamples item={c.item} />,
};
