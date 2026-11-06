"use client";

import { useTranslations } from "next-intl";
import type { ReadingRow, DictationRow } from "./readingDictationRows";

// The per-type content editors of the exercise form, shared with the import review so both edit exercises the same way.

export type BlankRow = { answer: string; options: string }; // options: comma-separated

// Appends/strips a trailing "\n" on a segment, rendered as a horizontal divider in the practice card.
function toggleLineBreak(value: string): string {
    return value.endsWith("\n") ? value.slice(0, -1) : value + "\n";
}

function SegmentInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    const t = useTranslations("exercises");
    const hasBreak = value.endsWith("\n");
    return (
        <div className="flex items-center gap-2">
            <input
                className="input flex-1"
                placeholder={placeholder}
                value={hasBreak ? value.slice(0, -1) : value}
                onChange={(e) => onChange(hasBreak ? e.target.value + "\n" : e.target.value)}
            />
            <button
                type="button"
                className={`chip ${hasBreak ? 'bg-accent text-primary-foreground' : ''}`}
                title={t("lineBreakTitle")}
                onClick={() => onChange(toggleLineBreak(value))}
            >
                ⏎
            </button>
        </div>
    );
}

// Builds the content object + a human-readable question/answer pair for the structured types.
export function BlankContentEditor({
    hasOptions,
    segments, setSegments,
    blanks, setBlanks,
}: {
    hasOptions: boolean;
    segments: string[]; setSegments: (v: string[]) => void;
    blanks: BlankRow[]; setBlanks: (v: BlankRow[]) => void;
}) {
    const t = useTranslations("exercises");
    const addBlank = () => {
        setBlanks([...blanks, { answer: "", options: "" }]);
        setSegments([...segments, ""]);
    };
    const removeBlank = (i: number) => {
        setBlanks(blanks.filter((_, idx) => idx !== i));
        setSegments(segments.filter((_, idx) => idx !== i + 1));
    };
    return (
        <fieldset className="card flex flex-col gap-3 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("sentenceWithBlanks")}</legend>
            <SegmentInput
                placeholder={t("textBeforeFirstBlank")}
                value={segments[0] ?? ""}
                onChange={(v) => setSegments([v, ...segments.slice(1)])}
            />
            {blanks.map((blank, i) => (
                <div key={i} className="flex flex-col gap-2 border-t border-dashed border-border pt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge">{t("blankN", { n: i + 1 })}</span>
                        <input
                            className="input w-fit"
                            placeholder={t("answer")}
                            value={blank.answer}
                            onChange={(e) => setBlanks(blanks.map((b, idx) => idx === i ? { ...b, answer: e.target.value } : b))}
                            required
                        />
                        {hasOptions && (
                            <input
                                className="input"
                                placeholder={t("options")}
                                value={blank.options}
                                onChange={(e) => setBlanks(blanks.map((b, idx) => idx === i ? { ...b, options: e.target.value } : b))}
                            />
                        )}
                        <button type="button" className="chip-remove" onClick={() => removeBlank(i)}>x</button>
                    </div>
                    <SegmentInput
                        placeholder={t("textAfterBlank")}
                        value={segments[i + 1] ?? ""}
                        onChange={(v) => setSegments(segments.map((s, idx) => idx === i + 1 ? v : s))}
                    />
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={addBlank}>{t("addBlank")}</button>
        </fieldset>
    );
}

export function QuizzContentEditor({
    options, setOptions,
    correct, setCorrect,
}: {
    options: string[]; setOptions: (v: string[]) => void;
    correct: number[]; setCorrect: (v: number[]) => void;
}) {
    const t = useTranslations("exercises");
    const toggleCorrect = (i: number) => {
        setCorrect(correct.includes(i) ? correct.filter(c => c !== i) : [...correct, i]);
    };
    const removeOption = (i: number) => {
        setOptions(options.filter((_, idx) => idx !== i));
        setCorrect(correct.filter(c => c !== i).map(c => c > i ? c - 1 : c));
    };
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("optionsCheckAll")}</legend>
            {options.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={correct.includes(i)}
                        onChange={() => toggleCorrect(i)}
                    />
                    <input
                        className="input"
                        placeholder={t("optionText")}
                        value={option}
                        onChange={(e) => setOptions(options.map((o, idx) => idx === i ? e.target.value : o))}
                        required
                    />
                    {options.length > 1 && <button type="button" className="chip-remove" onClick={() => removeOption(i)}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setOptions([...options, ""])}>{t("addOption")}</button>
        </fieldset>
    );
}

export function MatchingContentEditor({ pairs, setPairs }: { pairs: [string, string][]; setPairs: (v: [string, string][]) => void }) {
    const t = useTranslations("exercises");
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("pairs")}</legend>
            {pairs.map((pair, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input className="input" placeholder={t("left")} value={pair[0]} onChange={(e) => setPairs(pairs.map((p, idx) => idx === i ? [e.target.value, p[1]] : p))} required />
                    <input className="input" placeholder={t("right")} value={pair[1]} onChange={(e) => setPairs(pairs.map((p, idx) => idx === i ? [p[0], e.target.value] : p))} required />
                    {pairs.length > 1 && <button type="button" className="chip-remove" onClick={() => setPairs(pairs.filter((_, idx) => idx !== i))}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setPairs([...pairs, ["", ""]])}>{t("addPair")}</button>
        </fieldset>
    );
}

export function ReadingContentEditor({ rows, setRows }: { rows: ReadingRow[]; setRows: (v: ReadingRow[]) => void }) {
    const t = useTranslations("exercises");
    const set = (i: number, patch: Partial<ReadingRow>) => setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("readingLines")}</legend>
            {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input className="input w-32" placeholder={t("speakerOptional")} value={r.speaker} onChange={(e) => set(i, { speaker: e.target.value })} />
                    <input className="input flex-1" placeholder={t("lineText")} value={r.text} onChange={(e) => set(i, { text: e.target.value })} required />
                    <input className="input flex-1" placeholder={t("translationOptional")} value={r.translation} onChange={(e) => set(i, { translation: e.target.value })} />
                    {rows.length > 1 && <button type="button" className="chip-remove" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setRows([...rows, { speaker: rows[rows.length - 1]?.speaker ?? "", text: "", translation: "", audioIndex: null }])}>{t("addLine")}</button>
        </fieldset>
    );
}

export function DictationContentEditor({ rows, setRows }: { rows: DictationRow[]; setRows: (v: DictationRow[]) => void }) {
    const t = useTranslations("exercises");
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("dictationLines")}</legend>
            {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input className="input" placeholder={t("lineText")} value={r.text} onChange={(e) => setRows(rows.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))} required />
                    {rows.length > 1 && <button type="button" className="chip-remove" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setRows([...rows, { text: "", audioIndex: null }])}>{t("addLine")}</button>
        </fieldset>
    );
}

export function OrganizeContentEditor({ items, setItems }: { items: string[]; setItems: (v: string[]) => void }) {
    const t = useTranslations("exercises");
    return (
        <fieldset className="card flex flex-col gap-2 w-full">
            <legend className="text-sm font-medium px-1 w-fit">{t("items")}</legend>
            {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted">#{i + 1}</span>
                    <input className="input" value={item} onChange={(e) => setItems(items.map((it, idx) => idx === i ? e.target.value : it))} required />
                    {items.length > 1 && <button type="button" className="chip-remove" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>x</button>}
                </div>
            ))}
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setItems([...items, ""])}>{t("addItem")}</button>
        </fieldset>
    );
}

