"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

const glyphs = (text: string) => Array.from(text).filter((c) => c.trim() !== "" && c !== ",");

/** The key radical and the components of a character: both are characters of the language. Suggestions come from the
 *  characters already in it (native datalist); one that does not exist yet is marked "new" and is created when the form is saved. */
export default function CharacterLinksField({ own, known, creating, radical, onRadical, components, onComponents }: {
    own: string;
    known: string[];
    creating: boolean;
    radical: string;
    onRadical: (v: string) => void;
    components: string[];
    onComponents: (v: string[]) => void;
}) {
    const t = useTranslations("calligraphy");
    const id = useId();
    const [draft, setDraft] = useState("");
    const exists = (g: string) => known.includes(g);
    const options = known.filter((g) => g !== own);

    const add = (text: string) => {
        const next = [...components];
        for (const g of glyphs(text)) if (g !== own && !next.includes(g)) next.push(g);
        onComponents(next);
        setDraft("");
    };

    return (
        <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-medium text-foreground">{t("structureLegend")}</legend>
            <p className="text-sm text-muted">{creating ? t("structureHintCreate") : t("structureHintUpdate")}</p>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-radical`} className="text-sm font-medium text-foreground">{t("radicalLabel")}</label>
                <input
                    id={`${id}-radical`} className="input w-24 text-center font-serif text-xl" lang="zh" list={`${id}-known`}
                    value={radical} onChange={(e) => onRadical(glyphs(e.target.value).slice(0, 1).join(""))}
                    aria-describedby={`${id}-radical-status`} autoComplete="off"
                />
                <p id={`${id}-radical-status`} role="status" className="min-h-5 text-sm text-muted">
                    {radical && radical !== own && t(exists(radical) ? "radicalExists" : "radicalNew", { glyph: radical })}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-components`} className="text-sm font-medium text-foreground">{t("componentsLabel")}</label>
                <div className="flex flex-wrap items-center gap-2">
                    {components.map((g) => (
                        <span key={g} className={`chip font-serif text-base ${exists(g) ? "" : "border border-dashed border-accent"}`}>
                            {g}
                            {!exists(g) && <span className="font-sans text-xs">{t("componentNew")}</span>}
                            <button type="button" className="chip-remove" aria-label={t("removeComponent", { glyph: g })}
                                onClick={() => onComponents(components.filter((c) => c !== g))}>
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </span>
                    ))}
                    <input
                        id={`${id}-components`} className="input w-32 text-center font-serif text-xl" lang="zh" list={`${id}-known`}
                        value={draft} autoComplete="off"
                        onChange={(e) => (/[\s,，、]/.test(e.target.value) ? add(e.target.value) : setDraft(e.target.value))}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); add(draft); }
                            else if (e.key === "Backspace" && draft === "" && components.length) onComponents(components.slice(0, -1));
                        }}
                        onBlur={() => draft && add(draft)}
                    />
                </div>
            </div>
            <datalist id={`${id}-known`}>{options.map((g) => <option key={g} value={g} />)}</datalist>
        </fieldset>
    );
}
