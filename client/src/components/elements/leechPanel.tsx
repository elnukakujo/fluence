"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { saveCardNote, type Leech } from "@/api/review";
import Field from "@/components/ui/field";
import Modal from "@/components/ui/dialogs/modal";
import { STUDY } from "@/shared/studyConstants";

/** Help for a card that keeps slipping: how often it was missed, what the word is made of, and a memory trick of the user's own.
 *  A small chip (it takes no room in the page) opens the help in a portal dialog, so the card never jumps. */
export default function LeechPanel({ id, leech, note }: { id: string; leech: Leech; note?: string | null }) {
    const t = useTranslations("elements");
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(note ?? "");
    const [saved, setSaved] = useState(note ?? "");
    const save = () => {
        if (text === saved) return;
        setSaved(text);
        saveCardNote(id, text).catch(() => setSaved(saved));      // not saved: the next blur tries again
    };
    const close = () => { save(); setOpen(false); };       // the field unmounts with the dialog: a blur may never fire, so save here too
    return (
        <>
            <button type="button" className="badge inline-flex min-h-6 items-center gap-1" onClick={() => setOpen(true)} aria-haspopup="dialog">
                <AlertCircle size={12} aria-hidden />{t("leechChip", { count: leech.lapses })}
            </button>
            {open && (
                <Modal title={t("leechBanner", { count: leech.lapses })} onClose={close}>
                                <p className="text-sm text-muted" data-testid="leech-leaving">{t("leechLeaving", { count: leech.correct_in_row ?? 0, total: STUDY.leech.leaveCorrectInRow })}</p>
                    {leech.confusable && <p className="text-sm">{t("leechConfusable", { word: leech.confusable.word, translation: leech.confusable.translation })}</p>}
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
                    <Field label={t("leechNote")}>
                      <textarea className="input" rows={2} maxLength={500} value={text} placeholder={t("leechNotePlaceholder")} onChange={(e) => setText(e.target.value)} onBlur={save} />
                    </Field>
                </Modal>
            )}
        </>
    );
}
