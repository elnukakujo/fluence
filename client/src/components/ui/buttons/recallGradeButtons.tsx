import { useEffect } from "react";
import { useTranslations } from "next-intl";

export type RecallGrade = "again" | "hard" | "good" | "easy";

type GradeOption = {
    value: RecallGrade;
    labelKey: string;
    hintKey: string;
    score: number;
};

const GRADES_CONFIG: GradeOption[] = [
    { value: "again", labelKey: "again", hintKey: "blank",     score: 0 },
    { value: "hard",  labelKey: "hard",  hintKey: "struggled", score: 0.5 },
    { value: "good",  labelKey: "good",  hintKey: "recalled",  score: 0.75 },
    { value: "easy",  labelKey: "easy",  hintKey: "instant",   score: 1 },
];

type RecallGradeButtonsProps = {
    onGrade: (score: number) => void;
    /** The grade that matches how the card went; marked with text. The user still chooses. */
    suggested?: RecallGrade;
};

export default function RecallGradeButtons({ onGrade, suggested }: RecallGradeButtonsProps) {
    const t = useTranslations("ui");

    // keys 1-4 grade without the mouse (not while typing in a field)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (e.ctrlKey || e.metaKey || e.altKey || el?.closest?.("input, textarea, select, [contenteditable]")) return;
            const grade = GRADES_CONFIG[Number(e.key) - 1];
            if (grade) onGrade(grade.score);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onGrade]);

    const GRADES = GRADES_CONFIG.map(g => ({
        ...g,
        label: t(g.labelKey),
        hint: t(g.hintKey),
    }));

    return (
        <section className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                {t("howWellRemember")}
            </p>
            <div className="btn-row flex-wrap">
                {GRADES.map(({ value, label, hint, score }, i) => (
                    <button
                        key={value}
                        onClick={() => onGrade(score)}
                        className={`grade-btn grade-${value}`}
                        aria-keyshortcuts={String(i + 1)}
                    >
                        <span className="grade-dot" />
                        <span className="grade-label">{label}</span>
                        <span className="grade-hint">{hint}</span>
                        {suggested === value && <span className="badge">{t("suggested")}</span>}
                    </button>
                ))}
            </div>
        </section>
    );
}