"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Speaker = {
    id: string;
    name: string;
    isUser: boolean;
};

export type ConversationLine = {
    speakerId: string;
    text: string;
    audioIndex: number | null;
};

export type ConversationData = {
    speakers: Speaker[];
    lines: ConversationLine[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
    return Math.random().toString(36).slice(2, 9);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConversationInput({
    value,
    onChange,
    totalAudioSlots = 0,
}: {
    value?: string;
    onChange: (fields: { question: string; answer: string }) => void;
    totalAudioSlots?: number;
}) {
    const t = useTranslations("exercises");
    // ── Init ──────────────────────────────────────────────────────────────────
    const initialData = (): { speakers: Speaker[]; lines: ConversationLine[] } => {
        if (value) {
            try {
                return JSON.parse(value);
            } catch {
                console.warn("Failed to parse conversation data, falling back to default.");
            }
        }
        const user: Speaker = { id: generateId(), name: "You", isUser: true };
        const other: Speaker = { id: generateId(), name: "Speaker A", isUser: false };
        return {
            speakers: [user, other],
            lines: [
                { speakerId: other.id, text: "", audioIndex: null },
                { speakerId: user.id, text: "", audioIndex: null },
            ],
        };
    };

    const init = initialData();
    const [speakers, setSpeakers] = useState<Speaker[]>(init.speakers);
    const [lines, setLines] = useState<ConversationLine[]>(init.lines);

    // ── Emit ──────────────────────────────────────────────────────────────────
    const emitRef = useRef(onChange);
    emitRef.current = onChange;

    useEffect(() => {
        const question: ConversationData = { speakers, lines };

        const userIds = new Set(speakers.filter((s) => s.isUser).map((s) => s.id));
        const answer: ConversationData = {
            speakers: speakers.filter((s) => s.isUser),
            lines: lines.filter((l) => userIds.has(l.speakerId)),
        };

        emitRef.current({
            question: JSON.stringify(question),
            answer: JSON.stringify(answer),
        });
    }, [speakers, lines]);

    // ── Speaker ops ───────────────────────────────────────────────────────────
    const addSpeaker = () => {
        if (speakers.length >= 5) return;
        const newSp: Speaker = {
            id: generateId(),
            name: `Speaker ${String.fromCharCode(64 + speakers.length)}`,
            isUser: false,
        };
        setSpeakers((prev) => [...prev, newSp]);
    };

    const removeSpeaker = (id: string) => {
        const fallback = speakers.find((s) => s.id !== id)!.id;
        setSpeakers((prev) => prev.filter((s) => s.id !== id));
        setLines((prev) =>
            prev.map((l) => (l.speakerId === id ? { ...l, speakerId: fallback } : l))
        );
    };

    const renameSpeaker = (id: string, name: string) => {
        setSpeakers((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    };

    // ── Line ops ──────────────────────────────────────────────────────────────
    const addLine = () => {
        const last = lines[lines.length - 1];
        const nextSpeaker =
            speakers.find((s) => s.id !== last?.speakerId)?.id ?? speakers[0].id;
        setLines((prev) => [...prev, { speakerId: nextSpeaker, text: "", audioIndex: null }]);
    };

    const updateLine = (index: number, updated: ConversationLine) => {
        setLines((prev) => prev.map((l, i) => (i === index ? updated : l)));
    };

    const removeLine = (index: number) => {
        if (lines.length <= 1) return;
        setLines((prev) => prev.filter((_, i) => i !== index));
    };

    const moveLine = (index: number, direction: "up" | "down") => {
        setLines((prev) => {
            const next = [...prev];
            const target = direction === "up" ? index - 1 : index + 1;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4 w-full">

            {/* Speakers */}
            <fieldset className="card flex flex-col gap-2">
                <legend className="text-sm font-medium px-1 w-fit">{t("speakers")}</legend>

                {speakers.map((sp) => (
                    <div key={sp.id} className="flex items-center gap-2">
                        {sp.isUser ? (
                            <span className="text-sm">{sp.name} (you)</span>
                        ) : (
                            <input
                                type="text"
                                value={sp.name}
                                onChange={(e) => renameSpeaker(sp.id, e.target.value)}
                                className="input text-sm"
                                maxLength={20}
                            />
                        )}
                        {!sp.isUser && speakers.length > 2 && (
                            <button type="button" onClick={() => removeSpeaker(sp.id)} className="text-sm text-danger">
                                {t("remove")}
                            </button>
                        )}
                    </div>
                ))}

                {speakers.length < 5 && (
                    <button type="button" onClick={addSpeaker} className="text-sm text-accent self-start">
                        {t("addSpeaker")}
                    </button>
                )}
            </fieldset>

            {/* Lines */}
            <fieldset className="card flex flex-col gap-3">
                <legend className="text-sm font-medium px-1 w-fit">{t("conversation")}</legend>

                {lines.map((line, idx) => (
                    <div key={idx} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted">#{idx + 1}</span>

                            <select
                                value={line.speakerId}
                                onChange={(e) => updateLine(idx, { ...line, speakerId: e.target.value })}
                                className="input w-fit text-sm"
                            >
                                {speakers.map((sp) => (
                                    <option key={sp.id} value={sp.id}>
                                        {sp.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={line.audioIndex ?? ""}
                                onChange={(e) =>
                                    updateLine(idx, {
                                        ...line,
                                        audioIndex: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                }
                                className="input w-fit text-sm"
                            >
                                <option value="">{t("noAudio")}</option>
                                {Array.from({ length: totalAudioSlots }, (_, i) => (
                                    <option key={i} value={i}>Audio #{i + 1}</option>
                                ))}
                            </select>

                            <button type="button" onClick={() => moveLine(idx, "up")} disabled={idx === 0} className="text-xs text-muted disabled:opacity-30">↑</button>
                            <button type="button" onClick={() => moveLine(idx, "down")} disabled={idx === lines.length - 1} className="text-xs text-muted disabled:opacity-30">↓</button>
                            <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 1} className="text-xs text-danger disabled:opacity-30">{t("remove")}</button>
                        </div>

                        <textarea
                            value={line.text}
                            onChange={(e) => updateLine(idx, { ...line, text: e.target.value })}
                            rows={2}
                            placeholder={t("lineText")}
                            className="input text-sm resize-none"
                        />
                    </div>
                ))}

                <button type="button" onClick={addLine} className="text-sm text-accent self-start">
                    {t("addLine")}
                </button>
            </fieldset>
        </div>
    );
}