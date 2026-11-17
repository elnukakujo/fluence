import { useTranslations } from "next-intl";
import { PenLine, PenOff } from "lucide-react";
import type Calligraphy from "@/interface/features/Calligraphy";
import { submitCalligraphyDrawing } from "@/api/calligraphy";
import CalligraphyPracticeCanvas, { guidanceFor } from "@/components/elements/calligraphyPracticeCanvas";
import CharacterCard, { CharacterStructure } from "@/components/elements/characterCard";
import { loadStrokeData } from "@/lib/calligraphy/strokeData";
import { isDrawFirst } from "@/utils/drawFirst";
import { scaffoldsFor, tierOf } from "@/utils/cardTier";
import FlipCard from "../FlipCard";
import NonVocabExamples from "./NonVocabExamples";
import type { ItemRenderer, RendererCtx } from "../types";

const tierFor = (item: Calligraphy) => tierOf(item as unknown as Parameters<typeof tierOf>[0]);

function PracticeButton({ c }: { c: RendererCtx<Calligraphy> }) {
    const tCal = useTranslations("calligraphy");
    return <button type="button" className="btn btn-secondary btn-sm min-h-11 inline-flex items-center gap-1.5" onClick={c.openPractice}><PenLine size={14} aria-hidden />{tCal("practiceButton")}</button>;
}

function PracticeResult({ r }: { r: { similarity: number; strokeOrderErrors: number } }) {
    const tCal = useTranslations("calligraphy");
    return (
        <section className="card flex flex-col gap-2.5">
            <h3 className="font-serif">{tCal("practiceResult")}</h3>
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted">{tCal("shapeSimilarity")}</span>
                <span className="stat-value">{Math.round(r.similarity * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted">{tCal("strokeOrder")}</span>
                <span className="text-sm font-medium">
                    {r.strokeOrderErrors === 0 ? tCal("strokeOrderCorrect") : tCal("strokeOrderErrors", { n: r.strokeOrderErrors })}
                </span>
            </div>
        </section>
    );
}

function CantDraw({ c }: { c: RendererCtx<Calligraphy> }) {
    const tCal = useTranslations("calligraphy");
    return (
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-secondary inline-flex items-center gap-2 min-h-11" onClick={c.closePractice}><PenOff size={16} aria-hidden />{tCal("cantDraw")}</button>
        </div>
    );
}

function Front({ c }: { c: RendererCtx<Calligraphy> }) {
    const t = useTranslations("elements");
    return (
        <>
            <h3 className="font-serif">{t("characterHeading")}</h3>
            <CharacterCard review character={c.item.character} hiddenTranslation={true} hiddenAdditionalInformations={c.showDetail} />
        </>
    );
}

export const calligraphyRenderer: ItemRenderer<Calligraphy> = {
    kindKey: "section_call",
    view: (item) => {
        const tier = tierFor(item);
        return { tier, showDetail: scaffoldsFor(tier).detail === "shown", listenFirst: false, choiceActive: false, typedMode: false };
    },
    // A strong character is always drawn; on other days a stable third of the weaker ones is, instead of the flip card.
    opensDrawing: (item) => { const tier = tierFor(item); return tier === "maintaining" || isDrawFirst(item, tier, new Date()); },
    canOpenDrawing: (item) => loadStrokeData(item.character.character ?? "").then((s) => !!s).catch(() => false),
    pre: (c) => (
        <>
            {!c.showPractice && !c.hintShown && <PracticeButton c={c} />}
            {c.practiceResult && <PracticeResult r={c.practiceResult} />}
        </>
    ),
    hintExtra: (c) => <PracticeButton c={c} />,
    body: (c) => c.showPractice ? (
        <CalligraphyPracticeCanvas character={c.item.character.character ?? ""} tier={c.tier!}
            onResult={async (r) => {
                try {
                    await submitCalligraphyDrawing(c.item.id!, r.similarity, r.strokeOrderErrors, c.elapsedMs(), c.hintUsed || guidanceFor(c.tier!) !== "none");   // a shown guide counts as a hint
                    c.drawingDone(r);
                } catch (e) {
                    console.error("Failed to submit drawing", e);
                }
            }}
            info={c.tier === "learning"
                ? <CharacterCard review character={c.item.character} hiddenTranslation={false} hiddenAdditionalInformations={false} />
                : <CharacterStructure tiles keyRadical={c.item.character.key_radical} components={c.item.character.component_refs} />} />
    ) : (
        <FlipCard hidden={c.hiddenTranslation} onReveal={c.reveal}
            front={<Front c={c} />}
            back={<CharacterCard review character={c.item.character} hiddenTranslation={false} hiddenAdditionalInformations={false} />} />
    ),
    escape: (c) => c.showPractice && !c.graded ? <CantDraw c={c} /> : null,
    post: (c) => <NonVocabExamples item={c.item} />,
};
