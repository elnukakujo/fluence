import { BaseContainer } from '../base';
import Lesson from './Lesson';

export default interface Language extends BaseContainer {
    name: string;
    alias?: string;
    flag?: string;
    target_iso639_2t?: string;
    source_iso639_2t?: string;
    
    user_id?: string;
    current_lesson_id?: string;
    lessons?: Partial<Lesson>[];
    collaborators?: string[];
    partial_collaborators?: string[];
};