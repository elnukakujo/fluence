import { BaseComponent } from '../base';

export default interface Character extends BaseComponent {
    character: string;
    phonetic: string;
    meaning?: string;
    radical?: string;
    strokes?: number;
    readings?: { kind: string; value: string; primary: boolean }[];
    key_radical_id?: string | null;
    components?: string[];
    used_in?: string[];
}