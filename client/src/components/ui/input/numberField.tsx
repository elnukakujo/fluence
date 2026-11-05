"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

/** Integer stepper: [−] value [+]. Replaces the browser spinners; typing still works. "" means empty (optional values). */
export default function NumberField({ value, onChange, min = 0, max, step = 1, ariaLabel, placeholder, disabled }: {
    value: number | "";
    onChange: (v: number | "") => void;
    min?: number;
    max?: number;
    step?: number;
    ariaLabel: string;
    placeholder?: string;
    disabled?: boolean;
}) {
    const t = useTranslations("ui");
    const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, n));
    const bump = (d: number) => onChange(clamp((value === "" ? min : value) + d));
    return (
        <span className="stepper">
            <button type="button" aria-label={t("decrease")} disabled={disabled || (value !== "" && value <= min)} onClick={() => bump(-step)}><Minus size={14} aria-hidden /></button>
            <input type="number" inputMode="numeric" min={min} max={max} step={step} value={value} placeholder={placeholder} disabled={disabled} aria-label={ariaLabel}
                onChange={(e) => onChange(e.target.value === "" ? "" : clamp(Math.floor(Number(e.target.value) || 0)))} />
            <button type="button" aria-label={t("increase")} disabled={disabled || (value !== "" && max !== undefined && value >= max)} onClick={() => bump(step)}><Plus size={14} aria-hidden /></button>
        </span>
    );
}
