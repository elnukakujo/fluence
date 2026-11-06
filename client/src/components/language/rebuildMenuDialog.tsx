"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

/** In-app confirmation for rebuilding the running period's menu: says what is kept and what is redrawn. */
export default function RebuildMenuDialog({ open, mastered, redraw, onConfirm, onCancel }:
    { open: boolean; mastered: number; redraw: number; onConfirm: () => void; onCancel: () => void }) {
    const t = useTranslations("study");
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (open) cancelRef.current?.focus(); }, [open]);
    if (!open) return null;

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Tab") {            // two buttons: keep focus inside the dialog
            const next = document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current;
            if (e.shiftKey === (document.activeElement === cancelRef.current)) { e.preventDefault(); next?.focus(); }
        }
    };

    return (
        <div className="dialog-backdrop" onKeyDown={onKeyDown}>
            <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="rebuild-title">
                <h2 id="rebuild-title" className="text-lg font-semibold">{t("goalRebuildTitle")}</h2>
                <ul className="flex flex-col gap-1 text-sm">
                    <li>{t("goalRebuildKept", { count: mastered })}</li>
                    <li>{t("goalRebuildRedraw", { count: redraw })}</li>
                </ul>
                <p className="text-sm text-muted">{t("goalRebuildNote")}</p>
                <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" ref={cancelRef} className="btn btn-secondary min-h-11" onClick={onCancel}>{t("goalCancel")}</button>
                    <button type="button" ref={confirmRef} className="btn btn-danger min-h-11" onClick={onConfirm}>{t("goalRebuildConfirm")}</button>
                </div>
            </div>
        </div>
    );
}
