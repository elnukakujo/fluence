import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import type Exercise from "@/interface/features/Exercise";
import type { ItemRenderer, SessionItem } from "../types";
import { vocabularyRenderer } from "./vocabularyRenderer";
import { grammarRenderer } from "./grammarRenderer";
import { calligraphyRenderer } from "./calligraphyRenderer";
import { exerciseRenderer } from "./exerciseRenderer";

export const isVocabulary = (c: SessionItem): c is Vocabulary => "word" in c;
export const isGrammar = (c: SessionItem): c is Grammar => "title" in c;
export const isCalligraphy = (c: SessionItem): c is Calligraphy => "character" in c;
export const isExercise = (c: SessionItem): c is Exercise => "exercise_type" in c;

/** The presentation for a review card. Detected by shape (a vocabulary has `word`, a grammar `title`, ...), like the shell always has. */
export function rendererFor(item: SessionItem): ItemRenderer<SessionItem> {
    const r = isVocabulary(item) ? vocabularyRenderer : isGrammar(item) ? grammarRenderer : isCalligraphy(item) ? calligraphyRenderer : exerciseRenderer;
    return r as unknown as ItemRenderer<SessionItem>;
}
