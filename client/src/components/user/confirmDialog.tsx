"use client";

import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";

export default function ConfirmDialog({
    message,
    onConfirm,
    onCancel,
    confirmLabel,
    danger = false,
}: {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    danger?: boolean;
}) {
    const t = useTranslations("ui");
    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="card flex flex-col gap-4 max-w-sm w-full">
                <p className="text-center">{message}</p>
                <div className="flex gap-2 justify-center">
                    <button
                        type="button"
                        className={danger ? "btn btn-danger" : "btn btn-primary"}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                    >
                        {t("cancel")}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
