"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/** Ask for the word instead of flipping the card: type it, give up, or fall back to flip-and-grade (e.g. no keyboard for the script). */
export default function TypeAnswer({ onSubmit, onGiveUp, onFlip }: { onSubmit: (value: string) => void; onGiveUp: () => void; onFlip: () => void }) {
    const t = useTranslations("elements");
    const [value, setValue] = useState("");
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.focus(); }, []);
    return (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value); }}>
            <label className="flex flex-col gap-1 text-sm">
                {t("typePrompt")}
                <input ref={ref} className="input" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
            </label>
            <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn btn-primary min-h-11" disabled={!value.trim()}>{t("typeCheck")}</button>
                <button type="button" className="btn btn-secondary min-h-11" onClick={onGiveUp}>{t("typeDontKnow")}</button>
                <button type="button" className="btn btn-secondary min-h-11" onClick={onFlip}>{t("typeFlipInstead")}</button>
            </div>
        </form>
    );
}
