import { BaseFeature } from '../base';
import Word from '../components/Word';
import Passage from '../components/Passage';

export default interface Vocabulary extends BaseFeature {
    word: Partial<Word>;
    front_score?: number;
    front_difficulty?: number;
    back_score?: number;
    back_difficulty?: number;
    side?: "front" | "back"; // set on review / flashcard items
    example_sentences?: Partial<Passage>[];
};