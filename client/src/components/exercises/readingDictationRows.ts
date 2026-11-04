import type Exercise from "@/interface/features/Exercise";

export type ReadingRow = { speaker: string; text: string; translation: string; audioIndex: number | null };
export type DictationRow = { text: string; audioIndex: number | null };
type Content = NonNullable<Exercise["content"]>;

const DEFAULT_SPEAKER = "—";

/** Form rows -> stored reading content: speakers are the distinct names in order (ids s1…), blank names use one default speaker. */
export function readingContent(rows: ReadingRow[]) {
    const names = [...new Set(rows.map((r) => r.speaker.trim() || DEFAULT_SPEAKER))];
    const speakers = names.map((name, i) => ({ id: `s${i + 1}`, name }));
    return {
        speakers,
        lines: rows.map((r) => ({
            speakerId: speakers[names.indexOf(r.speaker.trim() || DEFAULT_SPEAKER)].id,
            text: r.text.trim(), translation: r.translation.trim() || null, audioIndex: r.audioIndex,
        })),
    };
}

export const readingRows = (c?: Content): ReadingRow[] => {
    if (!c || !("speakers" in c)) return [{ speaker: "", text: "", translation: "", audioIndex: null }];
    const names = Object.fromEntries(c.speakers.map((s) => [s.id, s.name]));
    const single = c.speakers.length === 1;
    return c.lines.map((l) => ({ speaker: single && names[l.speakerId] === DEFAULT_SPEAKER ? "" : names[l.speakerId] ?? "", text: l.text, translation: l.translation ?? "", audioIndex: l.audioIndex }));
};

export const dictationContent = (rows: DictationRow[]) => ({ lines: rows.map((r) => ({ text: r.text.trim(), audioIndex: r.audioIndex })) });

export const dictationRows = (c?: Content): DictationRow[] =>
    c && "lines" in c && !("speakers" in c) ? c.lines.map((l) => ({ text: l.text, audioIndex: l.audioIndex })) : [{ text: "", audioIndex: null }];
