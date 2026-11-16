import { BaseDataCollection } from "@/interface/base";

export default interface ProgressTracking extends BaseDataCollection {
    element_id: string;
    element_type: string; // e.g., 'vocabulary', 'grammar', 'calligraphy', 'exercise'
    element_status: string; // e.g., 'new', 'reviewing', 'mastered'
    score_before: number;
    score_after: number;
    result: boolean; // true for correct, false for incorrect
    duration_ms: number; // time taken to answer in milliseconds
    hint_used?: boolean; // whether the user used a hint
    attempt_number?: number; // which attempt this is for the element
    daily_goal_reached_before?: boolean; // the day was already a streak day before this answer this attempt
}
