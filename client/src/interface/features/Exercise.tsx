import { BaseFeature } from "../base";

export type ExerciseContent =
    | { segments: string[]; blanks: { options?: string[]; answer: string }[] } // type_in_the_blank / select_in_the_blank
    | { pairs: [string, string][] } // matching
    | { items: string[]; answer_order: number[] } // organize
    | { statement: string; answer: boolean } // true_false
    | { options: string[]; correct: number[] } // quizz
    | { speakers: { id: string; name: string }[]; lines: { speakerId: string; text: string; translation?: string | null; audioIndex: number | null }[] } // reading
    | { lines: { text: string; audioIndex: number | null }[] }; // dictation

export default interface Exercise extends BaseFeature {
    exercise_type?: 'essay' | 'answering' | 'translate' | 'organize' | 'conversation' |
                    'type_in_the_blank' | 'select_in_the_blank' | 'matching' | 'true_false' | 'speaking' | 'quizz' | 'reading' | 'dictation';
    question: string;
    answer: string;
    text_support?: string;
    content?: ExerciseContent;
    user_mode?: "boost" | "ban" | null;   // this user's own mode on the exercise
    banned?: boolean;                      // effective ban (own or by type): never practised or reviewed
    boosted?: boolean;                     // effective boost
    needs?: string[];   // what the user must still provide before practising (e.g. "audio"); empty = ready

    related_vocabulary?: string[];
    related_calligraphy?: string[];
    related_grammar?: string[];
};