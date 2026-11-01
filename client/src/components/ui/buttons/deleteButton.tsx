"use client";

import { deleteElement } from "@/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

export default function DeleteButton({ element_id, children }: { element_id: string, children?: React.ReactNode }) {
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const t = useTranslations("ui");

    const router = useRouter();
    const handleDelete = async () => {
        try {
            await deleteElement(element_id);
            const pathname = window.location.pathname;
            let parentPath = pathname.substring(0, pathname.lastIndexOf('/')) || '/';
            while (/(voc|gram|call|lesson|languages)$/.test(parentPath)) {
                parentPath = parentPath.substring(0, parentPath.lastIndexOf('/')) || '/';
            }
            router.push(parentPath);
            // Optionally, you can add some success feedback here
        } catch (error) {
        console.error("Failed to delete element:", error);
        // Optionally, you can add some error feedback here
        }
    };

    return (
        <div>
            <button type="button" onClick={() => setIsDeleting(true)} className="btn btn-danger">
                {children || t("deleteElement")}
            </button>
            {isDeleting && createPortal(
                <div className="fixed inset-0 z-50 flex flex-col gap-3 items-center justify-center bg-black/60 backdrop-blur-sm">
                    <p className="text-white">{t("areYouSureDelete")}</p>
                    <div className="flex flex-row gap-2">
                        <button type="button" onClick={handleDelete} className="btn btn-danger">
                            {t("confirmDelete")}
                        </button>
                        <button type="button" onClick={() => setIsDeleting(false)} className="btn btn-secondary">
                            {t("cancel")}
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}