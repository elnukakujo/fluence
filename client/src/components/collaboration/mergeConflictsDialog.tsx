"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/dialogs/modal";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import type { MergeChoice, MergeConflict } from "@/api/collaboration";

const CHOICES: MergeChoice[] = ["keep", "overwrite", "merge"];

const show = (values: Record<string, unknown>, fields: string[]) => fields.map((f) => `${f}: ${String(values[f] ?? "")}`).join(" · ");

/** One decision per conflicting item of a full merge (keep mine / take theirs / fill my gaps). Confirm stays off until every item has one. */
export default function MergeConflictsDialog({ conflicts, onConfirm, onCancel }: {
    conflicts: MergeConflict[];
    onConfirm: (decisions: Record<string, MergeChoice>) => void;
    onCancel: () => void;
}) {
    const t = useTranslations("collaboration");
    const [decisions, setDecisions] = useState<Record<string, MergeChoice>>({});
    const complete = conflicts.every((c) => decisions[c.id]);

    return (
        <Modal title={t("conflictsTitle")} onClose={onCancel}
            footer={<>
                <button type="button" className="btn btn-secondary min-h-11" onClick={onCancel}>{t("decline")}</button>
                <button type="button" className="btn btn-primary min-h-11" disabled={!complete} onClick={() => onConfirm(decisions as Record<string, MergeChoice>)}>{t("conflictsConfirm")}</button>
            </>}>
            <p className="text-sm text-muted">{t("conflictsIntro", { count: conflicts.length })}</p>
            <ul className="flex list-none flex-col gap-3 p-0">
                {conflicts.map((c) => (
                    <li key={c.id} className="card flex flex-col gap-2">
                        <strong>{c.key}</strong>
                        <span className="text-sm">{t("conflictMine")}: {show(c.existing, c.diff)}</span>
                        <span className="text-sm">{t("conflictTheirs")}: {show(c.incoming, c.diff)}</span>
                        <ClassicSelectMenu
                            ariaLabel={`${c.key}: ${t("conflictChoice")}`}
                            options={CHOICES}
                            optionLabel={(o) => t(`choice.${o}`)}
                            selectedOption={decisions[c.id] ?? ""}
                            placeholder={t("conflictChoice")}
                            onChange={(v) => setDecisions((d) => ({ ...d, [c.id]: v as MergeChoice }))}
                        />
                    </li>
                ))}
            </ul>
        </Modal>
    );
}
