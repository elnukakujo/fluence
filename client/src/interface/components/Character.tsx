import { BaseComponent } from '../base';

export type CharacterRef = { id: string; character: string };

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
    // sheet only: the linked characters with their glyph, and the form's typed components
    key_radical?: CharacterRef | null;
    component_refs?: CharacterRef[];
    used_in_refs?: CharacterRef[];
    radical_of_refs?: CharacterRef[];
    component_of_refs?: CharacterRef[];
    component_glyphs?: string[];
    clear_radical?: boolean;
}