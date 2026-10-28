export default interface Source {
    id: string;
    user_id: string;
    title: string;
    date?: string; // ISO date string
    description?: string;
    source_type?: string; // "original", "textbook", "class", "online", "media", "social", "other" (Not allowed to add by users: "ai")
    elements?: Record<string, { id: string; label: string }[]>; // element type -> resolved {id, label}
}
