"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { saveCardNote, type Leech } from "@/api/review";

/** Help for a card that keeps slipping: how often it was missed, what the word is made of, and a memory trick of the user's own. */
export default function LeechPanel({ id, leech, note }: { id: string; leech: Leech; note?: string | null }) {
    const t = useTranslations("elements");
    const [text, setText] = useState(note ?? "");
    const [saved, setSaved] = useState(note ?? "");
    const save = () => {
        if (text === saved) return;
        setSaved(text);
        saveCardNote(id, text).catch(() => setSaved(saved));      // not saved: the next blur tries again
    };
    return (
        <section className="card flex flex-col gap-3">
            <p role="status" className="flex items-center gap-2 font-medium"><AlertCircle size={16} aria-hidden />{t("leechBanner", { count: leech.lapses })}</p>
            {leech.parts.length > 0 && (
                <div>
                    <p className="text-sm text-muted">{t("leechParts")}</p>
                    <ul className="flex flex-wrap gap-3">
                        {leech.parts.map((p) => (
                            <li key={p.character} className="flex items-baseline gap-1">
                                <span className="font-serif text-xl">{p.character}</span>
                                <span className="text-sm text-muted">{[p.phonetic && `/${p.phonetic}/`, p.meaning].filter(Boolean).join(" ")}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <label className="flex flex-col gap-1 text-sm">
                {t("leechNote")}
                <textarea className="input" rows={2} maxLength={500} value={text} placeholder={t("leechNotePlaceholder")} onChange={(e) => setText(e.target.value)} onBlur={save} />
            </label>
        </section>
    );
}
