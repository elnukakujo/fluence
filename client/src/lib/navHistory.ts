// The pages the user visited this tab, so the navbar Back returns to the last valid one instead of the URL's parent.
const KEY = "nav-history";
const MAX = 50;
const FORM = /\/(new|update)$/;   // a form you left is stale (saved or abandoned): never a back target

const read = (): string[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const write = (h: string[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(h.slice(-MAX))); } catch { /* storage full or blocked: Back falls back to the parent path */ } };

export function recordVisit(path: string) {
    const h = read();
    if (h.at(-1) !== path) write([...h, path]);
}

/** A path that turned out invalid (404 or error page): drop it so Back never returns there. */
export function forgetVisit(path: string) {
    write(read().filter((p) => p !== path));
}

/** The most recent visited path that is not `current` and not a form; null when there is none. Rewinds the history to just before it. */
export function popBackTarget(current: string): string | null {
    const h = read();
    const i = h.findLastIndex((p) => p !== current && !FORM.test(p));
    if (i < 0) return null;
    write(h.slice(0, i));
    return h[i];
}
