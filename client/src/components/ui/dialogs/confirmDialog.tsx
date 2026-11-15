"use client";

import { useTranslations } from "next-intl";
import Modal from "./modal";

/** Asks before something irreversible. Built on the shared `Modal` (dialog role, labelled by its title, Escape closes, focus restored). */
export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, danger = false }: {
    title?: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    danger?: boolean;
}) {
    const t = useTranslations("ui");
    return (
        <Modal title={title ?? t("confirmTitle")} onClose={onCancel}
            footer={<>
                <button type="button" className="btn btn-secondary min-h-11 min-w-11" onClick={onCancel}>{t("cancel")}</button>
                <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"} min-h-11 min-w-11`} onClick={onConfirm}>{confirmLabel}</button>
            </>}>
            <p>{message}</p>
        </Modal>
    );
}
