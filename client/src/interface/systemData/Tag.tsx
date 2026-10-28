export default interface Tag {
    id: string;
    user_id: string;
    name: string;
    color?: string; // Hex color code, e.g., "#FF5733"
    description?: string;
    elements?: Record<string, { id: string; label: string }[]>; // element type -> resolved {id, label}
}
