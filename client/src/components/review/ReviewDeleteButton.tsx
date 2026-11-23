"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteElement } from "@/api";
import ConfirmDialog from "@/components/ui/dialogs/confirmDialog";

/** Deletes the card's element from inside a review (RC-23), after a confirmation. Available before the answer: a card that makes no sense cannot be answered.
 *  `onDeleted` runs once the server confirmed; a refusal (shared, not allowed) stays on the card with its message. */
export default function ReviewDeleteButton({ elementId, onDeleted }: { elementId: string; onDeleted: () => void }) {
    const t = useTranslations("elements");
    const tUi = useTranslations("ui");
    const [asking, setAsking] = useState(false);
    const [failed, setFailed] = useState(false);

    const confirm = async () => {
        setAsking(false);
        try {
            await deleteElement(elementId);
            setFailed(false);
            onDeleted();
        } catch {
            setFailed(true);
        }
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button type="button" className="btn btn-secondary !p-2 min-h-11 min-w-11 inline-flex items-center justify-center" aria-label={t("deleteButton")} title={t("deleteButton")} onClick={() => { setFailed(false); setAsking(true); }}>
                <Trash2 size={18} aria-hidden />
            </button>
            {failed && <p role="alert" className="text-sm text-danger">{t("deleteFailed")}</p>}
            {asking && <ConfirmDialog danger message={t("deleteCardConfirm")} confirmLabel={tUi("confirmDelete")} onConfirm={confirm} onCancel={() => setAsking(false)} />}
        </div>
    );
}
