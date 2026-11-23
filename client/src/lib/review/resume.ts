/** An interrupted review picks up where it stopped (RC-27): per language and scope, kept in this browser, gone at local midnight. */
export type Resume = { ids: string[]; done: string[]; sessionId: string; day: string };

const PREFIX = "review-resume:";
/** The learner's local day, "2026-11-23". */
const today = () => new Date().toLocaleDateString("sv");

export function saveResume(key: string, state: Omit<Resume, "day">): void {
    try { localStorage.setItem(PREFIX + key, JSON.stringify({ ...state, day: today() })); } catch { /* storage full or blocked: resuming is a courtesy */ }
}

export function loadResume(key: string): Resume | null {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw) return null;
        const r = JSON.parse(raw) as Resume;
        if (r.day !== today()) { localStorage.removeItem(PREFIX + key); return null; }
        return r;
    } catch { return null; }
}

export function clearResume(key: string): void {
    try { localStorage.removeItem(PREFIX + key); } catch { /* nothing to clear */ }
}
