"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";

export type RadicalOption = { character: string; meaning: string; id: string | null };

/** The key radical and the components of a character, picked from the language's radicals (nobody can type 氵 on a keyboard).
 *  Both use the app's one dropdown: type a meaning or paste a glyph to filter, arrows and Enter to pick.
 *  A radical the learner does not have yet is marked "new" and is created when the form is saved. */
export default function CharacterLinksField({ own, radicals, creating, radical, onRadical, components, onComponents }: {
    own: string;
    radicals: RadicalOption[];
    creating: boolean;
    radical: string;
    onRadical: (v: string) => void;
    components: string[];
    onComponents: (v: string[]) => void;
}) {
    const t = useTranslations("calligraphy");
    const id = useId();
    const byGlyph = new Map(radicals.map((r) => [r.character, r]));
    const isNew = (g: string) => byGlyph.get(g)?.id === null;           // not in the list = a character the learner already has
    const withCurrent = (current: string[]) => [...radicals.map((r) => r.character).filter((g) => g !== own), ...current.filter((g) => g && !byGlyph.has(g) && g !== own)];
    const common = {
        optionHint: (g: string) => byGlyph.get(g)?.meaning,
        optionSearch: (g: string) => byGlyph.get(g)?.meaning,
        optionLabel: (g: string) => g,
        valueClassName: "font-serif text-lg",
        lang: "zh",
        searchable: true,
        className: "w-full",
    };

    return (
        <section role="group" aria-labelledby={`${id}-title`} className="card flex flex-col gap-4">
            <header className="flex flex-col gap-1">
                <h2 id={`${id}-title`} className="text-lg font-semibold">{t("structureLegend")}</h2>
                <p className="text-sm text-muted">{creating ? t("structureHintCreate") : t("structureHintUpdate")}</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
                <div className="flex flex-col gap-1">
                    <ClassicSelectMenu {...common} label={t("radicalLabel")} clearable placeholder={t("radicalPlaceholder")}
                        options={withCurrent(radical ? [radical] : [])} selectedOption={radical} onChange={(v) => onRadical(v as string)} />
                    <p role="status" className="min-h-5 text-sm text-muted">
                        {radical && radical !== own && isNew(radical) && t("radicalNew", { glyph: radical })}
                    </p>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <ClassicSelectMenu {...common} multiple label={t("componentsLabel")} placeholder={t("componentsPlaceholder")}
                        options={withCurrent(components)} selectedOption={components} onChange={(v) => onComponents(v as string[])}
                        chipLabel={(g) => (isNew(g) ? `${g} · ${t("componentNew")}` : g)} />
                    <p className="min-h-5 text-sm text-muted" />
                </div>
            </div>
        </section>
    );
}
