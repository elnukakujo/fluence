"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";

export default function EditableField({
    label,
    value,
    onSave,
    type = "text",
    placeholder,
}: {
    label: string;
    value: string;
    onSave: (value: string) => Promise<void>;
    type?: string;
    placeholder?: string;
}) {
    const t = useTranslations("settings.buttons");
    const [editing, setEditing] = useState(false);
    const [current, setCurrent] = useState(value);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (current === value) { setEditing(false); return; }
        setSaving(true);
        try {
            await onSave(current);
            setEditing(false);
        } catch {
            // keep editing on failure so user doesn't lose input
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setCurrent(value);
        setEditing(false);
    };

    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm opacity-70">{label}</label>
            {editing ? (
                <div className="flex items-center gap-2">
                    <AutoWidthInput
                        type={type}
                        value={current}
                        onChange={(e) => setCurrent(e.target.value)}
                        placeholder={placeholder ?? value}
                        disabled={saving}
                    />
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "..." : t("save")}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCancel}
                        disabled={saving}
                    >
                        {t("cancel")}
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <span className="input">{current || <span className="opacity-40">Not set</span>}</span>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditing(true)}
                    >
                        Edit
                    </button>
                </div>
            )}
        </div>
    );
}
