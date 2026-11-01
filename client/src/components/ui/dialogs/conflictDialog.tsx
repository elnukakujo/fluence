"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import ConflictError from "@/api/conflictError";
import { useTranslations } from "next-intl";

// error.diff never includes score/difficulty/dates (always keep the existing
// value) or tags/sources/media (combined automatically) — see
// DuplicateEntityError.EXCLUDED_FROM_DIFF server-side. Whatever's left is a
// real per-field decision for the user.

// Reuses the fixed-overlay createPortal pattern from buttons/deleteButton.tsx.
export default function ConflictDialog({
    error,
    onKeep,
    onOverwrite,
    onManualResolve,
    onCancel,
}: {
    error: ConflictError;
    onKeep: () => void;
    onOverwrite: () => void;
    onManualResolve: (resolvedFields: Record<string, string>) => void;
    onCancel: () => void;
}) {
    const editableFields = error.diff;
    const t = useTranslations("ui");

    const [values, setValues] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const field of editableFields) {
            initial[field] = String(error.incoming[field] ?? error.existing[field] ?? "");
        }
        return initial;
    });

    return createPortal(
        <div className="fixed inset-0 z-50 flex flex-col gap-4 items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="card max-w-lg w-full flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
                <h3 className="text-lg font-semibold">
                    {t("thisEntityExists", { entityType: error.entityType })}
                </h3>
                <p className="text-sm text-muted">
                    {t("entityExistsDescription", { entityType: error.entityType })}
                </p>

                {editableFields.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {editableFields.map((field) => (
                            <div key={field} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0">
                                <span className="font-medium text-sm">{field}</span>
                                <div className="flex flex-row gap-2 text-xs text-muted">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setValues(v => ({ ...v, [field]: String(error.existing[field] ?? "") }))}
                                    >
                                        {t("useExisting", { value: String(error.existing[field] ?? "—") })}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setValues(v => ({ ...v, [field]: String(error.incoming[field] ?? "") }))}
                                    >
                                        {t("useIncoming", { value: String(error.incoming[field] ?? "—") })}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="input"
                                    value={values[field] ?? ""}
                                    onChange={(e) => setValues(v => ({ ...v, [field]: e.target.value }))}
                                    placeholder={t("typeValueFor", { field })}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <p className="text-xs text-muted">
                    {t("mediaTagsSourcesCombined")}
                    {" "}
                    {t("scoreDifficultydatesKeep")}
                </p>

                <div className="flex flex-row gap-2 justify-end flex-wrap pt-2">
                    <button type="button" onClick={onCancel} className="btn btn-secondary">
                        {t("cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={onKeep}
                        className="btn btn-secondary"
                        title={t("keepExistingTitle")}
                    >
                        {t("keepExisting")}
                    </button>
                    <button
                        type="button"
                        onClick={onOverwrite}
                        className="btn btn-danger"
                        title={t("overwriteTitle")}
                    >
                        {t("overwrite")}
                    </button>
                    {editableFields.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onManualResolve(values)}
                            className="btn btn-primary"
                            title={t("applyChosenValuesTitle")}
                        >
                            {t("applyChosenValues")}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
