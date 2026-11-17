"use client";

import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import ToggleRow from "./toggleRow";
import type { SettingValue } from "@/api/settings";

export type Field =
    | { key: string; kind: "toggle" }
    | { key: string; kind: "number"; min: number; max: number; step?: number }
    | { key: string; kind: "choice"; options: string[] }
    | { key: string; kind: "multi"; options: string[] };

type T = (key: string) => string;

/** One setting row: a switch, a number, or a menu, with its label and one line of help. `t` resolves `<key>` and `<key>Desc`; `to` the option labels. */
export default function FieldControl({ field: f, value, onChange, disabled, t, to }: {
    field: Field; value: SettingValue | undefined; onChange: (v: SettingValue) => void; disabled: boolean; t: T; to: T;
}) {
    if (f.kind === "toggle") {
        return <ToggleRow label={t(f.key)} description={t(`${f.key}Desc`)} checked={Boolean(value)} onChange={onChange} disabled={disabled} />;
    }
    if (f.kind === "number") {
        return (
            <label className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex flex-col"><span className="text-sm font-medium">{t(f.key)}</span><span className="text-xs text-muted">{t(`${f.key}Desc`)}</span></span>
                <input type="number" className="input w-24" min={f.min} max={f.max} step={f.step ?? 1} value={Number(value ?? 0)}
                    onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} />
            </label>
        );
    }
    return (
        <div className="flex flex-col gap-1 py-2.5">
            <ClassicSelectMenu
                label={t(f.key)}
                options={f.options}
                optionLabel={(o) => to(o)}
                multiple={f.kind === "multi"}
                selectedOption={f.kind === "multi" ? ((value as string[] | undefined) ?? []) : String(value ?? "")}
                onChange={(v) => onChange(v as SettingValue)}
                disabled={disabled}
            />
            <span className="text-xs text-muted">{t(`${f.key}Desc`)}</span>
        </div>
    );
}
