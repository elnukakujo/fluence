import {BaseContainer} from '../base';
import Calligraphy from '../features/Calligraphy';
import Grammar from '../features/Grammar';
import Vocabulary from '../features/Vocabulary';
import Exercise from '../features/Exercise';

export default interface Lesson extends BaseContainer {
    id: string;
    title: string;
    
    user_id?: string;
    language_id: string;
    target_iso639_2t?: string;
    shared?: boolean;
    collaborators?: string[];
    vocabularies?: Partial<Vocabulary>[];
    grammars?: Partial<Grammar>[];
    calligraphies?: Partial<Calligraphy>[];
    exercises?: Partial<Exercise>[];
};