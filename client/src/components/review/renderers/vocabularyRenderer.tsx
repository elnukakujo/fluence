import { useTranslations } from "next-intl";
import { EarOff } from "lucide-react";
import type VocabularyBase from "@/interface/features/Vocabulary";
import type { Leech } from "@/api/review";
import { scoreTypedAnswer } from "@/api/process";
import { PUBLIC_BASE_URL } from "@/api";
import AudioPlayer from "@/components/media/audioPlayer";
import WordCard from "@/components/elements/wordCard";
import SentenceCard from "@/components/elements/sentenceCard";
import TypeAnswer from "@/components/elements/typeAnswer";
import LeechChoice from "@/components/elements/leechChoice";
import { HINT_CAPS } from "@/utils/cardHints";
import { scaffoldsFor, tierOf } from "@/utils/cardTier";
import { isListenFirst } from "@/utils/listenFirst";
import { gradeForTyped, gradeFromCloseness, matchesAnswer } from "@/utils/typedAnswer";
import FlipCard from "../FlipCard";
import type { ItemRenderer, RendererCtx } from "../types";

/** A vocabulary review card: the vocabulary plus what the review queue adds. */
type Vocabulary = VocabularyBase & { leech?: Leech };

/** A typed answer: graded by exact match, else by character closeness (a failed request keeps the exact-match grade). `null` = gave up. */
async function answerTyped(c: RendererCtx<Vocabulary>, value: string | null) {
    const correct = value !== null && matchesAnswer(value, c.item.word);
    const ms = c.elapsedMs();        // taken at submit: the request's latency never changes the speed bonus
    let grade = gradeForTyped(correct, ms), diff: number[] | undefined;
    if (value !== null && !correct && c.item.word.word) {
        c.setTypedPending(true);
        try {
            const r = await scoreTypedAnswer(value, c.item.word.word, c.languageId);
            grade = gradeFromCloseness(r.closeness, ms);
            diff = r.diff;
        } catch { /* exact-match grade */ }
        c.setTypedPending(false);
    }
    c.setTyped({ correct, diff: grade > 0 ? diff : undefined });
    c.showAnswer();
    c.grade(Math.min(grade, HINT_CAPS[c.effectiveLevel]), "typed");
}

function Choice({ c }: { c: RendererCtx<Vocabulary> }) {
    const t = useTranslations("elements");
    const other = c.item.leech!.confusable!, back = c.item.side === "back";
    const options = [{ label: (back ? c.item.word.word : c.item.word.translation) ?? "", correct: true }, { label: back ? other.word : other.translation, correct: false }];
    const flipped = [...c.item.id!].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 2 === 1;      // stable per card, so the right one is not always first
    return <LeechChoice prompt={back ? t("chooseWord", { translation: c.item.word.translation ?? "" }) : t("chooseMeaning", { word: c.item.word.word ?? "" })}
        options={flipped ? options.reverse() : options} onPick={c.pickChoice} />;
}

function Typed({ c }: { c: RendererCtx<Vocabulary> }) {
    const t = useTranslations("elements");
    const { word } = c.item, typed = c.typed;
    return (
        <section className="flex flex-col gap-3">
            <WordCard word={word} hiddenTranslation={c.hiddenTranslation} hiddenAdditionalInformations={false} reverse showPhonetic={c.showDetail} />
            {c.hiddenTranslation ? (
                <TypeAnswer pending={c.typedPending} onSubmit={(v) => answerTyped(c, v)} onGiveUp={() => answerTyped(c, null)} onFlip={c.flipInsteadOfTyping} />
            ) : typed && (
                typed.diff ? (
                    <p role="status" className="font-medium">
                        {t("typeClose")}{" "}
                        <span aria-label={t("typeDiffLabel", { chars: [...(word.word ?? "")].filter((_, i) => typed.diff!.includes(i)).join(" ") })}>
                            {[...(word.word ?? "")].map((ch, i) => typed.diff!.includes(i) ? <u key={i} className="font-bold">{ch}</u> : ch)}
                        </span>
                    </p>
                ) : (
                    <p role="status" className="font-medium">{typed.correct ? t("typeRight") : t("typeWrong", { word: word.word ?? "" })}</p>
                )
            )}
        </section>
    );
}

function Front({ c }: { c: RendererCtx<Vocabulary> }) {
    const t = useTranslations("elements");
    const { item } = c;
    return c.listenFirst ? <>
        <p className="text-center text-lg font-medium">{t("listenPrompt")}</p>
        {/* on the card, front side only (the back side asks for the word, the clip would give it away); playing must not flip the card */}
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><AudioPlayer src={PUBLIC_BASE_URL + item.word.audio_files![0]} /></div>
    </> : <>
        <WordCard word={item.word} hiddenTranslation={true} hiddenAdditionalInformations={false} reverse={item.side === "back"} showPhonetic={c.showDetail} />
        {c.example !== undefined && <SentenceCard sentence={c.example as Parameters<typeof SentenceCard>[0]["sentence"]} hiddenTranslation={true} />}
    </>;
}

export const vocabularyRenderer: ItemRenderer<Vocabulary> = {
    kindKey: "section_voc",
    sideOf: (item) => item.side,
    scoreSide: (item) => (item.side as "front" | "back" | undefined) ?? "front",
    view: (item, s) => {
        const tier = tierOf(item as unknown as Parameters<typeof tierOf>[0]);
        const scaffolds = scaffoldsFor(tier);
        return {
            tier,
            showDetail: scaffolds.detail === "shown",                                                              // phonetic on the front
            listenFirst: isListenFirst(item, tier, new Date()) && !s.cantHear,                                      // hear the clip before seeing the word
            example: scaffolds.example && item.side !== "back" ? item.example_sentences?.[0] : undefined,          // never on the back side: the sentence contains the answer
            choiceActive: !!item.leech?.confusable && !s.choiceDone && s.hiddenTranslation && !s.graded,
            typedMode: tier === "maintaining" && item.side === "back" && !s.flipInstead,
        };
    },
    body: (c) => c.choiceActive && c.item.leech?.confusable ? <Choice c={c} />
        : c.typedMode ? <Typed c={c} />
        : <FlipCard hidden={c.hiddenTranslation} onReveal={c.reveal} front={<Front c={c} />}
            back={<WordCard word={c.item.word} hiddenTranslation={false} hiddenAdditionalInformations={false} />} />,
    // a listen-first card: the escape sits below the card, like the skip buttons under an exercise
    escape: (c) => c.listenFirst && c.hiddenTranslation && !c.graded ? <CantHear c={c} /> : null,
    post: (c) => <Examples item={c.item} />,
};

function CantHear({ c }: { c: RendererCtx<Vocabulary> }) {
    const t = useTranslations("elements");
    return (
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-secondary inline-flex items-center gap-2 min-h-11" onClick={c.cantHearCard}><EarOff size={16} aria-hidden />{t("cantHearCard")}</button>
        </div>
    );
}

function Examples({ item }: { item: Vocabulary }) {
    const t = useTranslations("elements");
    if (!item.example_sentences || item.example_sentences.length === 0) return null;
    return (
        <section className="flex flex-col space-y-4">
            <h3 className="font-serif">{t("exampleSentences", { ns: "vocabulary" })}</h3>
            {item.example_sentences.map((sentence, index) => (
                <SentenceCard key={index} sentence={sentence} hiddenTranslation={false} />
            ))}
        </section>
    );
}
