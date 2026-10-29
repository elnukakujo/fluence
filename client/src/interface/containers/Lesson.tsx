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
    collaborators?: string[];
    vocabularies?: Partial<Vocabulary>[];
    grammars?: Partial<Grammar>[];
    calligraphies?: Partial<Calligraphy>[];
    exercises?: Partial<Exercise>[];
};