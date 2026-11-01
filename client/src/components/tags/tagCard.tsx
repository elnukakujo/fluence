import Tag from '@/interface/systemData/Tag';
import { getTranslations } from "next-intl/server";

type RowConfig = {
    key: "voc" | "call" | "gram" | "ex" | "lesson" | "lang";
    labelKey: string;
}

const ROWS_CONFIG: RowConfig[] = [
    { key: "voc",    labelKey: "vocab" },
    { key: "call",   labelKey: "calli" },
    { key: "gram",   labelKey: "grammar" },
    { key: "ex",     labelKey: "exercise" },
    { key: "lesson", labelKey: "lesson" },
    { key: "lang",   labelKey: "lang" },
] as const;

export default async function TagCard({ tag }: { tag: Tag }) {
    const elements = tag.elements;
    const t = await getTranslations("tags");

    const ROWS = ROWS_CONFIG.map(({ key, labelKey }) => ({
        key,
        label: t(labelKey),
    }));

    return (
        <div className="pl-4 py-3 border-l-2" style={{ borderColor: tag.color }}>
            <h2 className="text-base font-medium mb-1" style={{ color: tag.color }}>{tag.name}</h2>
            <p className="text-sm text-muted mb-3">{tag.description}</p>

            {elements && (
                <div className="index-divider pt-3 flex flex-col gap-1.5">
                    {ROWS
                        .map(({ key, label }) => ({
                            key,
                            label,
                            text: elements[key]?.map((e) => e.label ?? "").filter(Boolean).join(" · "),
                        }))
                        .filter((s) => Boolean(s.text))
                        .map(({ key, label, text }) => (
                            <div key={key} className="flex gap-2 text-xs items-baseline">
                                <span className="text-muted w-14 shrink-0">{label}</span>
                                <span className="text-foreground">{text}</span>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}
