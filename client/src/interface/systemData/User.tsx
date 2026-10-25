import UserPreferences from "./UserPreferences";

export default interface User {
    id: string;
    username: string;
    display_name?: string;
    email?: string;
    password?: string; // write-only: only ever sent when creating/updating, never present in a GET response
    last_review: string; // ISO date string
    created_at: string; // ISO date string
    is_admin?: boolean;
    blocked?: boolean;
    last_login_at?: string | null; // ISO date string
    preferences?: Partial<UserPreferences>; // Optional user preferences
}
